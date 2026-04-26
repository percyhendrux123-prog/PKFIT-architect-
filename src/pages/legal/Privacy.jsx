import { Link } from 'react-router-dom';
import privacySource from '../../content/legal/privacy.md?raw';
import { MarkdownDoc } from '../../components/MarkdownDoc';

export default function Privacy() {
  return (
    <div className="mx-auto max-w-reading px-5 py-12">
      <Link to="/" className="label mb-6 inline-block">← Back</Link>
      <MarkdownDoc source={privacySource} />
    </div>
  );
}
