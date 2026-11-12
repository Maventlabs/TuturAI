'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { GSAPLines, GSAPReveal } from './gsap-helpers'

const faqs = [
  {
    question: 'Apa itu TuturAI?',
    answer:
      'Platform latihan speaking bahasa Inggris untuk siswa SMA/SMK. Kamu bicara dengan partner AI, lalu mendapat feedback lima dimensi: pronunciation, fluency, intonation, grammar, dan vocabulary.',
  },
  {
    question: 'Apakah TuturAI gratis?',
    answer:
      'Gratis untuk siswa. Guru bisa mendaftarkan kelas tanpa biaya, dan sekolah bisa memakai paket perangkat offline untuk kelas yang tidak punya internet.',
  },
  {
    question: 'Bagaimana AI menilai kemampuan bicaraku?',
    answer:
      'Setiap sesi dinilai pada lima dimensi. Transkrip dari browser hanya bisa menilai grammar, vocabulary, dan fluency — pronunciation dan intonation butuh audio asli, jadi ditandai bukti belum cukup, bukan dikira-kira.',
  },
  {
    question: 'Bisa dipakai tanpa internet?',
    answer:
      'Bisa. PWA menyimpan latihan di perangkat dan mengirimnya saat kembali online. Perangkat ESP32-S3 untuk kelas berjalan penuh secara offline.',
  },
  {
    question: 'Apakah suara AI bisa memakai suara guru?',
    answer:
      'Bisa. Guru melakukan enrollment voice profile sekali, lalu suara itu dipakai untuk latihan di kelasnya. Profil suara bisa dihapus atau didaftarkan ulang kapan saja.',
  },
  {
    question: 'Bagaimana guru memantau kemajuan siswa?',
    answer:
      'Dashboard guru menampilkan tren kemampuan kelas, kesalahan yang paling sering muncul, dan siswa yang perlu didampingi. Laporan bisa diunduh sebagai PDF.',
  },
  {
    question: 'Apakah data siswa aman?',
    answer:
      'Data disimpan di Firestore dengan aturan akses per peran. Siswa hanya melihat datanya sendiri, guru hanya melihat kelasnya, dan sampel suara tidak dipakai untuk tujuan lain.',
  },
  {
    question: 'Bagaimana cara memulai?',
    answer:
      'Daftar sebagai siswa atau guru, lalu ikuti sesi speaking pertama. Tidak perlu kartu kredit dan tidak perlu memasang aplikasi.',
  },
]

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="scroll-mt-24 bg-card px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="mx-auto max-w-3xl text-center">
          <GSAPReveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
              Ada pertanyaan?
            </p>
          </GSAPReveal>

          <GSAPLines>
            <h2 className="mt-4 font-heading text-3xl font-bold leading-[1.08] tracking-[-0.02em] text-foreground text-balance sm:text-4xl lg:text-5xl">
              <span data-line className="block">
                Pertanyaan yang
              </span>
              <span data-line className="block">
                sering diajukan
              </span>
            </h2>
          </GSAPLines>

          <GSAPReveal delay={0.1}>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/70">
              Frequently Asked Questions
            </p>
            <p className="mt-5 text-foreground text-pretty">
              <strong className="font-semibold text-primary-deep">Temukan jawaban</strong> soal cara
              kerja TuturAI, penilaian AI, dan pemakaiannya di kelas.
            </p>
          </GSAPReveal>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-3 md:grid-cols-2 md:gap-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index

            return (
              <GSAPReveal key={faq.question} delay={0.05 * (index % 2)}>
                <div
                  className={`h-full rounded-[4px] border border-primary/15 transition-colors duration-200 ${
                    isOpen ? 'bg-primary/[0.11]' : 'bg-primary/[0.06] hover:bg-primary/[0.09]'
                  }`}
                >
                  <h3>
                    <button
                      type="button"
                      id={`faq-trigger-${index}`}
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${index}`}
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-6"
                    >
                      <span className="font-heading text-base font-semibold text-primary-deep text-pretty">
                        {faq.question}
                      </span>
                      <Plus
                        aria-hidden
                        className={`h-5 w-5 shrink-0 text-primary-deep transition-transform duration-300 ${
                          isOpen ? 'rotate-45' : ''
                        }`}
                      />
                    </button>
                  </h3>

                  <div
                    id={`faq-panel-${index}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${index}`}
                    inert={!isOpen}
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                      isOpen ? 'grid-rows-[minmax(0,1fr)]' : 'grid-rows-[minmax(0,0fr)]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm leading-relaxed text-primary-deep text-pretty sm:px-6">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </GSAPReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
