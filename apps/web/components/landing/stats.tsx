const stats = [
  { value: '12.000+', label: 'Sesi speaking' },
  { value: '85%', label: 'Siswa lebih percaya diri' },
  { value: '120+', label: 'Sekolah mencoba' },
  { value: '24/7', label: 'Partner AI siap' },
]

export function Stats() {
  return (
    <section className="bg-primary py-14 text-primary-foreground">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 sm:px-6 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="font-heading text-3xl font-extrabold sm:text-4xl">
              {s.value}
            </p>
            <p className="mt-1 text-sm text-primary-foreground/80">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
