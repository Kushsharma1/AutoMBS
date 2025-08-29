'use client';

import { ChevronDownIcon, FileTextIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';

import { buttonVariants } from '@/components/ui/buttonVariants';
import { CenteredHero } from '@/features/landing/CenteredHero';
import { Section } from '@/features/landing/Section';

export const Hero = () => {
  const t = useTranslations('Hero');

  return (
    <Section className="py-36">
      <CenteredHero
        banner={<></>}
        title={t.rich('title', {
          important: chunks => (
            <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              {chunks}
            </span>
          ),
        })}
        description={t('description')}
        buttons={(
          <>
            <a
              className={buttonVariants({ size: 'lg' })}
              href="/sign-up"
            >
              <FileTextIcon className="mr-2 size-5" />
              {t('primary_button')}
            </a>

            <button
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
              onClick={() => {
                const featuresSection = document.querySelector('#features-section');
                if (featuresSection) {
                  featuresSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
              <ChevronDownIcon className="mr-2 size-5" />
              {t('secondary_button')}
            </button>
          </>
        )}
      />
    </Section>
  );
};
