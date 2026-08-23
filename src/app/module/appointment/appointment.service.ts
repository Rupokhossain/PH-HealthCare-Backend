import {
  AppointmentStatus,
  PaymentStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";

// 1st api create
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

    return {
      paymentUrl: bkashCreatePaymentResult.bkashURL,
    };
  });

  return transactionResult;
};

// 3rd api create
const payAppointment = async (payload: any, user: RequestUser) => {
  const appointmentId = payload.appointmentId;

  const existingAppointment = await prisma.appointment.findUnique({
    where: {
      id: appointmentId,
    },
  });

  if (!existingAppointment) {
    throw new Error("Appointment Does Not Exists");
  }

  if (existingAppointment.status === "CONFIRMED") {
    throw new Error("Appointment Already Paid And Confirmed");
  }

  if (existingAppointment.status !== "PENDING") {
    throw new Error("Appointment Is Not Pending!");
  }

  // if (
  //   existingAppointment.status === "CANCELLED" ||
  //   existingAppointment.status === "ONGONING" ||
  //   existingAppointment.status === "COMPLETED"
  // ) {
  //   const appointmentStatus = existingAppointment.status;
  //   throw new Error(`Appointment is already ${appointmentStatus.toLowerCase}`);
  // }

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

        merchantInvoiceNumber: existingAppointment.id,
      }),
    },
  );

  //   console.log("Callback URL:",
  //   `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`
  // );

  const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

  await prisma.payment.update({
    where: {
      appointmentId: existingAppointment.id,
    },

    data: {
      merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
      amount: "1200",
      gateWayResponse: bkashCreatePaymentResult,
      bkashPaymentId: bkashCreatePaymentResult.paymentID,
    },
  });

  return {
    paymentUrl: bkashCreatePaymentResult.bkashURL,
  };
};

// 4th api
const cancelAppointment = async (payload: any, user: RequestUser) => {
  const transactionResult = await prisma.$transaction(async (tx) => {
    const appointmentId = payload.appointmentId;

    const existingAppointment = await tx.appointment.findUnique({
      where: {
        id: appointmentId,
      },
      include: {
        payment: true,
      },
    });

    if (!existingAppointment) {
      throw new Error("Appointment Does Not Exists");
    }

    if (
      existingAppointment.status === "ONGONING" ||
      existingAppointment.status === "COMPLETED"
    ) {
      throw new Error("Appointment Ongoing or Completed");
    }

    if (existingAppointment.status === "CANCELLED") {
      throw new Error("Appointment Already Cancelled");
    }

    const updatedAppointent = await tx.appointment.update({
      where: {
        id: existingAppointment.id,
      },
      data: {
        status: "CANCELLED",
      },
    });

    const bkashToken = await getBkashIdToken();
    console.log(bkashToken, "bKash Token");

    if (!bkashToken) {
      throw new Error("No Bkash Access Token Found!");
    }

    const bkashRefundPaymentResponse = await fetch(
      `${config.bkash_base_url}/tokenized-checkout/refund/payment/transaction`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: bkashToken,
          "X-App-Key": config.bkash_api_key,
        },
        body: JSON.stringify({
          paymentId: existingAppointment.payment?.appointmentId,
          trxId: existingAppointment.payment?.bkashTrxId,
          refundAmount: existingAppointment.payment?.amount,
          reason: "Payment Cancelled The Appointment",
        }),
      },
    );

    const bkashRefundPaymentResult = await bkashRefundPaymentResponse.json();

    const updatePayment = await tx.payment.update({
      where: {
        appointmentId: existingAppointment.id,
      },
      data: {
        refundTrxId: bkashRefundPaymentResult.refundTrxId,
        refundedAt: bkashRefundPaymentResult.completedTime,
        refundAmount: bkashRefundPaymentResult.refundAmount,
        refundReason: bkashRefundPaymentResult.reason,
      },
    });

    return {
      appointment: updatedAppointent,
      payment: updatePayment,
    };
  });

  return transactionResult;
};

// 2nd api create
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
      await tx.appointment.update({
        where: {
          id: executedPaymentResult.merchantInvoiceNumber,
        },
        data: {
          status: AppointmentStatus.CONFIRMED,
        },
      });

      await tx.payment.update({
        where: {
          appointmentId: executedPaymentResult.merchantInvoiceNumber,
          bkashPaymentId: paymentId,
        },
        data: {
          status: PaymentStatus.PAID,
          bkashTrxId: executedPaymentResult.trxID,
          paidAt: executedPaymentResult.paymentExecuteTime,
          gateWayResponse: executedPaymentResult,
        },
      });

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
  payAppointment,
  bookiAppointmentCallback,
};
