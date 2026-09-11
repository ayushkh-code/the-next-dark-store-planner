const STEPS = [
  {
    title: 'Add your nodes',
    description: 'Enter the PINs you fulfil from today',
  },
  {
    title: 'See your coverage',
    description: 'Population & demand reached in 1–3 hours',
  },
  {
    title: 'Get expansion picks',
    description: 'Recommended PINs to add next',
  },
] as const;

export function HowItWorks() {
  return (
    <ol className="how-it-works" aria-label="How it works">
      {STEPS.map((step, i) => (
        <li key={step.title} className="how-it-works__step">
          <span className="how-it-works__num mono" aria-hidden="true">
            {i + 1}
          </span>
          <div className="how-it-works__body">
            <p className="how-it-works__title">{step.title}</p>
            <p className="how-it-works__desc">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
