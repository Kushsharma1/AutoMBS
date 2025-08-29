'use client';

import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';

import { Logo } from '@/templates/Logo';

export const DashboardHeader = (props: {
  menu: {
    href: string;
    label: string;
  }[];
}) => {

  return (
    <>
      <div className="flex items-center">
        <Link href="/dashboard" className="max-sm:hidden">
          <Logo />
        </Link>
      </div>

      <div>
        <UserButton
          userProfileMode="navigation"
          userProfileUrl="/dashboard/user-profile"
          appearance={{
            elements: {
              rootBox: 'px-2 py-1.5',
            },
          }}
        />
      </div>
    </>
  );
};
