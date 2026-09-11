interface TabPurposeProps {
  children: string;
}

/** Standard “What this tab does” one-liner shown at the top of each tab. */
export function TabPurpose({ children }: TabPurposeProps) {
  return (
    <p className="tab-purpose">
      <strong>What this tab does:</strong> {children}
    </p>
  );
}
