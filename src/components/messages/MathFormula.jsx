import katex from 'katex';
import 'katex/dist/katex.min.css';

export default function MathFormula({ formula }) {
  const html = katex.renderToString(formula, { throwOnError: false, trust: false, strict: 'error', displayMode: true, maxExpand: 500, maxSize: 20 });
  return <div className="em-math em-real-math" aria-label={`Công thức: ${formula}`} dangerouslySetInnerHTML={{ __html: html }}/>;
}
