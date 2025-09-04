// app/page.tsx
import { redirect } from 'next/navigation';

export default function Home() {
  // send everyone to the admin login (or /admin/orders if already doing auth elsewhere)
  redirect('/admin/login');
}