import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { Footer } from '@/templates/Footer';
import { Navbar } from '@/templates/Navbar';

export default async function CenteredLayout(props: { children: React.ReactNode }) {
  const { userId } = await auth();

  if (userId) {
    redirect('/dashboard');
  }

  return (
    <>
      <Navbar />
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        {props.children}
      </div>
      <Footer />
    </>
  );
}
