import { METHODOLOGY_FAQ } from '../methodologyFaq';
import { TAB_PURPOSE } from '../tabPurpose';
import { TabPurpose } from './TabPurpose';

/** Methodology FAQ tab: each question as a heading with answer below. */
export function MethodologyFaq() {
  return (
    <section className="mode-panel methodology-faq">
      <TabPurpose>{TAB_PURPOSE.methodology}</TabPurpose>

      <div className="methodology-faq__intro">
        <h2 className="methodology-faq__title">Methodology FAQ</h2>
        <p className="methodology-faq__subtitle">
          How data is sourced, how distances and coverage are modeled, and how
          to interpret results in The next Dark store planner.
        </p>
      </div>

      <div className="methodology-faq__list">
        {METHODOLOGY_FAQ.map((item) => (
          <article key={item.question} className="methodology-faq__item">
            <h3 className="methodology-faq__question">{item.question}</h3>
            {item.paragraphs.map((paragraph, i) => (
              <p key={i} className="methodology-faq__answer">
                {paragraph}
              </p>
            ))}
            {item.bullets && item.bullets.length > 0 && (
              <ul className="methodology-faq__bullets">
                {item.bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
