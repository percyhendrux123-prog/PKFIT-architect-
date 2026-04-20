import { useSignedUrl } from '../hooks/useSignedUrl';

export function StorageImage({ bucket = 'baseline-photos', path, alt, className = '' }) {
  const url = useSignedUrl(bucket, path);
  if (!path) return null;
  if (!url) {
    return (
      <div
        className={`flex items-center justify-center border border-line bg-black/30 text-[0.6rem] uppercase tracking-widest2 text-faint ${className}`}
      >
        Loading
      </div>
    );
  }
  return <img src={url} alt={alt ?? ''} loading="lazy" className={`border border-line ${className}`} />;
}
