import {
  AppointmentStatus,
  PaymentStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";

const bookAppointment = async (payload: any, user: RequestUser) => {
  const transactionResult = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.create({
      data: {
        status: AppointmentStatus.PENDING,
      },
    });

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
          // payerReference: "01770618575", // user email / phone number
          payerReference: user.email,
          callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
          amount: "500",
          currency: "BDT",
          intent: "sale",
          // merchantInvoiceNumber: "Inv3",  // appointment id

          merchantInvoiceNumber: appointment.id,
        }),
      },
    );

    //   console.log("Callback URL:",
    //   `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`
    // );

    const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

    // payment model create

    await tx.payment.create({
      data: {
        merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
        appointmentId: appointment.id,
        amount: "1200",
        gateWayResponse: bkashCreatePaymentResult,
        bkashPaymentId: bkashCreatePaymentResult.paymentID,
        payerReference: user.email,
      },
    });

    return bkashCreatePaymentResult.bkashURL;
  });

  return transactionResult;
};

const bookiAppointmentCallback = async (query: Record<string, any>) => {

  const transactionResult = await prisma.$transaction(async (tx) => {
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
      // await tx.appointment.update({
      //   where: {
      //     id: executedPaymentResult.merchantInvoiceNumber,
      //   },
      //   data: {
      //     status: AppointmentStatus.CONFIRMED,
      //   },
      // });

      // await tx.payment.update({
      //   where: {
      //     appointmentId: executedPaymentResult.merchantInvoiceNumber,
      //     bkashPaymentId: paymentId,
      //   },
      //   data: {
      //     status: PaymentStatus.PAID,
      //     bkashTrxId: executedPaymentResult.trxID,
      //     paidAt: executedPaymentResult.paymentExecuteTime,
      //     gateWayResponse: executedPaymentResult,
      //   },
      // });


      await tx.appointment.update({
        where: {
          id: executedPaymentResult.merchantInvoiceNumber
        },
        data: {
          status: AppointmentStatus.CONFIRMED
        }
      })

      return {
        executedPaymentResult,
        redirecUrl: `${config.frontend_url}/dashboard/my-appoinment?status=success`,
      };
    } else if (status === "failure") {
      await tx.payment.update({
        where: {
          bkashPaymentId: paymentId,
        },
        data: {
          status: PaymentStatus.FAILED,
          gateWayResponse: executedPaymentResult,
        },
      });

      return {
        redirecUrl: `${config.frontend_url}/dashboard/my-appoinment?status=failure`,
      };
    } else if (status === "cancel") {
      await tx.payment.update({
        where: {
          bkashPaymentId: paymentId,
        },
        data: {
          status: PaymentStatus.CANCELLED,
          gateWayResponse: executedPaymentResult,
        },
      });

      return {
        executedPaymentResult,
        redirecUrl: `${config.frontend_url}/dashboard/my-appoinment?status=cancel`,
      };
    } else {
      return {
        executedPaymentResult,
        redirecUrl: `${config.frontend_url}/dashboard/my-appoinment?error=payment-failed`,
      };
    }
  });

  return transactionResult;
};

export const AppointementServices = {
  bookAppointment,
  bookiAppointmentCallback,
};
