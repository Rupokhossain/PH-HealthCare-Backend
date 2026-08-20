import config from "../config";
import { redisClient } from "./redis";

export const getBkashIdToken = async () => {
  try {
    // ============================================================
    // STEP 1: Define Redis keys
    // We store the bKash ID token and refresh token in Redis
    // so that we don't need to call bKash token API on every request.
    // ============================================================
    const IdTokenKey = "bkash:idToken";
    const RefreshTokenKey = "bkash:refreshToken";

    // ============================================================
    // STEP 2: Get existing tokens and ID token TTL from Redis
    // ============================================================
    let bkashIdToken = await redisClient.get(IdTokenKey);
    const bkashRefreshToken = await redisClient.get(RefreshTokenKey);
    const bkashIdTokenTTL = await redisClient.ttl(IdTokenKey);
    const bkashRefreshTokenTTL = await redisClient.ttl(RefreshTokenKey);


    console.log({
      bkashIdToken,
      bkashIdTokenTTL,
      bkashRefreshToken,
      bkashRefreshTokenTTL
    })

    // ============================================================
    // STEP 3: Refresh the ID token if it is going to expire soon
    //
    // 600 seconds = 10 minutes.
    // bkash refresh token must exist
    // If the ID token has <= 10 minutes remaining and we have
    // a refresh token, use the refresh token to get a new ID token.
    // ============================================================
    if (
      (bkashIdTokenTTL <= 600 || !bkashIdToken) &&
      bkashRefreshToken &&
      bkashRefreshTokenTTL > 600
    ) {
      const refreshTokenResponse = await fetch(
        `${config.bkash_base_url}/tokenized/checkout/token/refresh`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            username: config.bkash_username,
            password: config.bkash_password,
          },

          // Send the existing refresh token to bKash
          // to generate a new ID token.
          body: JSON.stringify({
            app_key: config.bkash_api_key,
            app_secret: config.bkash_app_secret,
            refresh_token: bkashRefreshToken,
          }),
        },
      );

      if (!refreshTokenResponse.ok) {
        throw new Error("bKash Access Token Grant Failed");
      }

      const bkashRefreshTokenResult = await refreshTokenResponse.json();

      // Get the newly generated ID token from bKash response
      bkashIdToken = bkashRefreshTokenResult.id_token as string;

      // Update Redis with the new ID token.
      // Keep it for 1 hour.
      await redisClient.set(IdTokenKey, bkashIdToken, {
        expiration: {
          type: "EX",
          value: 60 * 60, // 1 hour
        },
      });

      // We already have a fresh ID token,
      // so return it and stop executing the function.
      return bkashIdToken;
    }

    // ============================================================
    // STEP 4: If the existing ID token is still valid,
    // return it directly from Redis.
    //
    // This avoids unnecessary bKash API calls.
    // ============================================================
    if (bkashIdTokenTTL > 600) {
      return bkashIdToken;
    }

    // ============================================================
    // STEP 5: No ID token exists in Redis.
    //
    // So we have to request a completely new token pair
    // from bKash using the Grant Token API.
    // ============================================================
    const response = await fetch(
      `${config.bkash_base_url}/tokenized/checkout/token/grant`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          username: config.bkash_username,
          password: config.bkash_password,
        },

        // Grant API needs the application's credentials.
        body: JSON.stringify({
          app_key: config.bkash_api_key,
          app_secret: config.bkash_app_secret,
        }),
      },
    );

    // NOTE:
    // fetch() normally throws an error on network failure.
    // It does NOT return null/undefined for an HTTP 4xx/5xx response.
    // So response.ok should also be checked here.
    if (!response.ok) {
      throw new Error("bKash Access Token Grant Failed");
    }

    // Convert bKash response into JSON
    const result = await response.json();

    // ============================================================
    // STEP 6: Store the new ID token in Redis
    // ID token is stored for 1 hour.
    // ============================================================
    await redisClient.set(IdTokenKey, result.id_token, {
      expiration: {
        type: "EX",
        value: 60 * 60, // 1 hour
      },
    });

    // ============================================================
    // STEP 7: Store the new refresh token in Redis
    // Refresh token is stored for 28 days.
    // ============================================================
    await redisClient.set(RefreshTokenKey, result.refresh_token, {
      expiration: {
        type: "EX",
        value: 60 * 60 * 24 * 28, // 28 days
      },
    });

    // ============================================================
    // STEP 8: Return the newly generated ID token
    // ============================================================
    bkashIdToken = result.id_token;

    return bkashIdToken;
  } catch (error: any) {
    // If anything fails, throw the error to the caller.
    throw new Error(error.message);
  }
};
