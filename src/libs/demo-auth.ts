// Demo authentication fallback when Clerk is not configured
export const DEMO_USER = {
  id: 'demo-user-123',
  firstName: 'Demo',
  lastName: 'User',
  emailAddresses: [{ emailAddress: 'demo@autombs.com' }],
  primaryEmailAddress: { emailAddress: 'demo@autombs.com' }
};

export function isDemoMode(): boolean {
  return !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 
         process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === '';
}

export function getDemoUser() {
  return DEMO_USER;
}
