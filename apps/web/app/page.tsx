export default function HomePage() {
  return (
    <main
      id="visaflow-foundation-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0a0a0c',
        color: '#f4f4f6',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1 id="visaflow-heading" style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 700 }}>
        VisaFlow
      </h1>
      <p id="visaflow-status" style={{ fontSize: '1.25rem', color: '#9ba1a6', margin: 0 }}>
        Foundation initialized.
      </p>
    </main>
  );
}
