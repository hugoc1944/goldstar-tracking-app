// lib/notify.ts Email trigger notification (API)
import { sendMail } from '@/lib/mail';
import { OrderCreatedEmail } from '@/emails/OrderCreated';
import { OrderStatusChangedEmail } from '@/emails/OrderStatusChanged';
import { AdminMessageToClientEmail } from '@/emails/AdminMessageToClient';
import { ClientMessageToAdminEmail } from '@/emails/ClientMessageToAdmin';

type Status = 'PREPARACAO'|'PRODUCAO'|'EXPEDICAO'|'ENTREGUE';

export type OrderForEmail = {
  publicToken: string;
  trackingNumber?: string | null;
  eta?: Date | null;
  expeditionPeriod?: 'MANHA' | 'TARDE' | null; 
  status?: Status;
  customer: { name: string; email: string };
  id?: string; // optional, for admin notifications
};

export async function notifyOrderCreated(order: OrderForEmail) {
  await sendMail({
    to: order.customer.email,
    subject: 'GOLDSTAR • Pedido criado',
    react: OrderCreatedEmail({
      customerName: order.customer.name,
      publicToken: order.publicToken,
    }),
  });
}

export async function notifyStatusChanged(order: OrderForEmail & { status: Status }) {
  await sendMail({
    to: order.customer.email,
    subject: 'GOLDSTAR • Estado atualizado',
    react: OrderStatusChangedEmail({
    customerName: order.customer.name,
    publicToken: order.publicToken,
    newStatus: order.status,
    eta: order.eta ? order.eta.toISOString() : null,
    expeditionPeriod: order.expeditionPeriod ?? null, 
    trackingNumber: order.trackingNumber ?? null,
  }),
  });
}

export async function notifyAdminMessageToClient(order: OrderForEmail, message: string) {
  await sendMail({
    to: order.customer.email,
    subject: 'GOLDSTAR • Nova mensagem sobre o seu pedido',
    react: AdminMessageToClientEmail({
      customerName: order.customer.name,
      message,
      publicToken: order.publicToken,
    }),
  });
}

export async function notifyClientMessageToAdmin(order: OrderForEmail, message: string) {
  const to = process.env.SUPPORT_TO!;
  await sendMail({
    to,
    subject: `GOLDSTAR • Mensagem do cliente (Pedido #${order.id?.slice(0,8) ?? ''})`,
    react: ClientMessageToAdminEmail({
      adminEmail: to,
      orderId: order.id ?? '—',
      customerName: order.customer.name,
      customerEmail: order.customer.email,
      message,
    }),
  });
}

export async function notifySupportMessage(args: {
  orderId: string;
  publicToken: string;
  customer: { name: string; email: string };
  message: string;
}) {
  const to = process.env.SUPPORT_TO!;
  if (!to) {
    console.warn('notifySupportMessage: SUPPORT_TO not set');
    return;
  }


  // Plain fallback in case you don’t want a separate email template:
  const subject = `GOLDSTAR • Mensagem do cliente · Pedido #${args.orderId.slice(0, 8)}`;

  console.log("TOOO----"+to)
  await sendMail({
  to,
  
  subject,
  react: ClientMessageToAdminEmail({
    adminEmail: to,
    orderId: args.orderId,
    customerName: args.customer.name,
    customerEmail: args.customer.email,
    message: args.message,
  }),
});
}