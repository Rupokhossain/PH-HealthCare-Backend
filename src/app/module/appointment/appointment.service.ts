import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";

const bookAppointment = async () => {
  const bkashToken = await getBkashIdToken();
  console.log( bkashToken, "bKash Token");

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
        merchantInvoiceNumber: "Inv0124",
      }),

      
    },
  );

  console.log("Callback URL:", 
  `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`
);

  const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

  return bkashCreatePaymentResult;
};


const bookiAppointmentCallback = () => {
    return{
        success: true
    }
}

export const AppointementServices = {
  bookAppointment,
  bookiAppointmentCallback
};
