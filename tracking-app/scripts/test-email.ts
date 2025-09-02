import 'dotenv/config';
import { sendMail } from '../lib/mail';
import { OrderCreatedEmail } from '../emails/OrderCreated';

(async () => {
  const to = process.env.TEST_EMAIL_TO || 'hugot1944@gmail.com';
  const res = await sendMail({
    to,
    subject: '[TESTE] OrderCreated',
    react: OrderCreatedEmail({ customerName: 'Hugo', publicToken: 'demo-token-123' }),
  });
  console.log(res);
})();
