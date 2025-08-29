import { useTranslations } from 'next-intl';

export const ProtectFallback = (props: { trigger: React.ReactNode }) => {
  const t = useTranslations('ProtectFallback');

  return (
    <div className="relative group">
      <div className="opacity-50 cursor-not-allowed">
        {props.trigger}
      </div>
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-black rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
        {t('not_enough_permission')}
      </div>
    </div>
  );
};