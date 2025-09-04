// app/page.tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/admin'); // or '/admin/login' if you require auth first
}