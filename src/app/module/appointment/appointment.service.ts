import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";

const bookAppointment = async () => {
  const bkashToken = await getBkashIdToken();
  console.log(bkashToken, "bKash Token");

  if (!bkashToken) {
    throw new Error("No Bkash Access Token Found!");
  }

  const bkashCreatePaymentResponse = await fetch(
    `${config.bkash_base_url}/tokenized/checkout/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: bkashToken,
        "X-App-Key": config.bkash_api_key,
      },
      body: JSON.stringify({
        mode: "0011",
        payerReference: "01770618575",
        callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
        amount: "500",
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: "Inv3",
      }),
    },
  );

  //   console.log("Callback URL:",
  //   `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`
  // );

  const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

  return bkashCreatePaymentResult;
};

const bookiAppointmentCallback = async (query: Record<string, any>) => {
  const paymentId = query.paymentID;

  if (!paymentId) {
    throw new Error("Payment Id Missing");
  }

  const status = query.status;

  if (!status) {
    throw new Error("Payment Status is Missing");
  }

  const bkashIdToken = await getBkashIdToken();

  if (!bkashIdToken) {
    throw new Error("No Bkash Access Token Found!");
  }

  const executedPaymentResponse = await fetch(
    `${config.bkash_base_url}/tokenized/checkout/execute`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: bkashIdToken,
        "X-App-Key": config.bkash_api_key,
      },

      body: JSON.stringify({
        paymentID: paymentId,
      }),
    },
  );

  const executedPaymentResult = await executedPaymentResponse.json();

  console.log({ executedPaymentResponse });

  if (status === "success") {
    return {
      executedPaymentResult,
      redirecUrl: `${config.frontend_url}/dashboard/my-appoinment?status=success`,
    };
  }
  if (status === "failure") {
    return {
      executedPaymentResult,
      redirecUrl: `${config.frontend_url}/dashboard/my-appoinment?status=failure`,
    };
  }
  if (status === "cancel") {
    return {
      executedPaymentResult,
      redirecUrl: `${config.frontend_url}/dashboard/my-appoinment?status=cancel`,
    };
  }

  return {
    executedPaymentResult,
    redirecUrl: `${config.frontend_url}/dashboard/my-appoinment`
  };
};

export const AppointementServices = {
  bookAppointment,
  bookiAppointmentCallback,
};
