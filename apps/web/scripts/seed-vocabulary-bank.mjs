import { readFileSync } from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

/**
 * Publishes the authored Vocabulary bank: twenty cards per level, plus a
 * reserve of forty cards kept as drafts for later sessions.
 *
 * Every card carries its own four meanings so the quiz never has to invent
 * distractors, and `correctOption` always points at the meaning inside that
 * same array — the server grades the index the client sends back.
 */

function loadLocalEnv() {
  const candidates = ['../.env.local', '../../../.env.development.local']
  for (const candidate of candidates) {
    try {
      const source = readFileSync(new URL(candidate, import.meta.url), 'utf8')
      for (const line of source.split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (!match || process.env[match[1]]) continue
        const value = match[2].trim().replace(/^["']+/, '').replace(/["']+$/, '')
        process.env[match[1]] = value.replace(/\\n/g, '\n')
      }
      return
    } catch {
      // Try the next location; CI can provide the admin variables directly.
    }
  }
}

loadLocalEnv()

const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  }),
})
const db = getFirestore(app)
const now = Timestamp.now()

// [word, meaning, ipa, example, tip, distractors]
const BANK = {
  beginner: {
    published: [
      ['borrow', 'meminjam', '/ˈbɒr.oʊ/', 'May I borrow your dictionary until Friday?', 'Borrow dipakai saat kamu menerima sesuatu untuk dipakai lalu dikembalikan.', ['meminjamkan', 'membeli', 'menyimpan']],
      ['arrive', 'tiba', '/əˈraɪv/', 'The bus will arrive at seven in the morning.', 'Arrive berarti sampai di suatu tempat.', ['berangkat', 'menunggu', 'kembali']],
      ['cheap', 'murah', '/tʃiːp/', 'This notebook is cheap but the paper is strong.', 'Cheap menjelaskan harga yang rendah.', ['mahal', 'langka', 'berat']],
      ['quiet', 'tenang', '/ˈkwaɪ.ət/', 'The library is quiet before the first lesson.', 'Quiet berarti tidak berisik.', ['ramai', 'cepat', 'terang']],
      ['healthy', 'sehat', '/ˈhel.θi/', 'She brings healthy food to school every day.', 'Healthy berarti dalam kondisi baik dan tidak sakit.', ['sakit', 'lelah', 'lapar']],
      ['tidy', 'rapi', '/ˈtaɪ.di/', 'Please keep your desk tidy before you leave.', 'Tidy berarti bersih dan tersusun.', ['kotor', 'sempit', 'gelap']],
      ['choose', 'memilih', '/tʃuːz/', 'You can choose one book from the shelf.', 'Choose berarti menentukan pilihan.', ['menolak', 'menjual', 'menulis']],
      ['explain', 'menjelaskan', '/ɪkˈspleɪn/', 'The teacher will explain the rule once more.', 'Explain berarti membuat sesuatu mudah dipahami.', ['menyembunyikan', 'menanyakan', 'melupakan']],
      ['repair', 'memperbaiki', '/rɪˈpeər/', 'My father can repair the broken chair.', 'Repair berarti membuat sesuatu berfungsi lagi.', ['merusak', 'menjual', 'mengecat']],
      ['share', 'berbagi', '/ʃeər/', 'We share our notes before every test.', 'Share berarti memberi sebagian kepada orang lain.', ['menyimpan', 'menyembunyikan', 'membeli']],
      ['early', 'lebih awal', '/ˈɜː.li/', 'She came early to clean the classroom.', 'Early berarti sebelum waktu yang biasa.', ['terlambat', 'lama', 'mendadak']],
      ['heavy', 'berat', '/ˈhev.i/', 'This box is too heavy to carry alone.', 'Heavy berarti sulit diangkat.', ['ringan', 'kecil', 'tipis']],
      ['careful', 'hati-hati', '/ˈkeə.fəl/', 'Be careful when you cross the road.', 'Careful berarti penuh perhatian agar tidak celaka.', ['ceroboh', 'cepat', 'berani']],
      ['promise', 'berjanji', '/ˈprɒm.ɪs/', 'I promise to return your book tomorrow.', 'Promise berarti menyatakan akan melakukan sesuatu.', ['melupakan', 'menolak', 'mengulang']],
      ['invite', 'mengundang', '/ɪnˈvaɪt/', 'They invite the whole class to the farewell party.', 'Invite berarti meminta orang lain datang.', ['melarang', 'mengantar', 'menemani']],
      ['prepare', 'mempersiapkan', '/prɪˈpeər/', 'We prepare the presentation two days before.', 'Prepare berarti menyiapkan sesuatu lebih dulu.', ['menunda', 'membatalkan', 'melupakan']],
      ['deliver', 'mengantar', '/dɪˈlɪv.ər/', 'The courier will deliver the package this afternoon.', 'Deliver berarti membawa sesuatu sampai ke tujuan.', ['mengambil', 'menyimpan', 'membuka']],
      ['lend', 'meminjamkan', '/lend/', 'Can you lend me your ruler for a moment?', 'Lend adalah memberi pinjaman kepada orang lain.', ['meminjam', 'menjual', 'membuang']],
      ['gather', 'mengumpulkan', '/ˈɡæð.ər/', 'The students gather in the hall every Monday.', 'Gather berarti mengumpulkan atau berkumpul.', ['menyebarkan', 'memisahkan', 'menghapus']],
      ['polite', 'sopan', '/pəˈlaɪt/', 'She is always polite to the new students.', 'Polite berarti berperilaku baik dan menghormati orang lain.', ['kasar', 'malas', 'pelit']],
    ],
    reserve: [
      ['empty', 'kosong', '/ˈemp.ti/', 'The classroom is empty after the last lesson.', 'Empty berarti tidak berisi apa pun.', ['penuh', 'ramai', 'berat']],
      ['crowded', 'penuh sesak', '/ˈkraʊ.dɪd/', 'The market is crowded on Sunday morning.', 'Crowded berarti berisi banyak orang.', ['sepi', 'luas', 'bersih']],
      ['honest', 'jujur', '/ˈɒn.ɪst/', 'An honest answer is better than a perfect one.', 'Honest berarti mengatakan kebenaran.', ['dusta', 'ragu', 'sombong']],
      ['brave', 'berani', '/breɪv/', 'It was brave of her to speak first.', 'Brave berarti tidak takut menghadapi kesulitan.', ['takut', 'lemah', 'malu']],
      ['curious', 'ingin tahu', '/ˈkjʊə.ri.əs/', 'The children are curious about the new machine.', 'Curious berarti ingin mengetahui lebih banyak.', ['acuh', 'bosan', 'yakin']],
      ['gentle', 'lembut', '/ˈdʒen.təl/', 'Use a gentle voice when you explain the mistake.', 'Gentle berarti halus dan tidak kasar.', ['keras', 'tajam', 'cepat']],
      ['narrow', 'sempit', '/ˈnær.oʊ/', 'The alley behind the school is very narrow.', 'Narrow berarti lebarnya kecil.', ['lebar', 'panjang', 'tinggi']],
      ['patient', 'sabar', '/ˈpeɪ.ʃənt/', 'A patient teacher repeats the answer calmly.', 'Patient berarti mampu menunggu tanpa marah.', ['buru-buru', 'marah', 'tegas']],
      ['simple', 'sederhana', '/ˈsɪm.pəl/', 'The instruction is simple enough for everyone.', 'Simple berarti tidak rumit.', ['rumit', 'panjang', 'mahal']],
      ['useful', 'berguna', '/ˈjuːs.fəl/', 'This dictionary is useful for writing essays.', 'Useful berarti memberi manfaat.', ['sia-sia', 'berbahaya', 'asing']],
    ],
  },
  intermediate: {
    published: [
      ['reliable', 'dapat diandalkan', '/rɪˈlaɪ.ə.bəl/', 'A reliable partner finishes the task on time.', 'Reliable berarti bisa dipercaya untuk bekerja dengan baik.', ['mudah rusak', 'mahal', 'asing']],
      ['postpone', 'menunda', '/pəˈspəʊn/', 'They postpone the meeting until the report is ready.', 'Postpone berarti memindahkan ke waktu yang lebih lambat.', ['mempercepat', 'membatalkan', 'mengulang']],
      ['efficient', 'efisien', '/ɪˈfɪʃ.ənt/', 'The new schedule is more efficient than the old one.', 'Efficient berarti mencapai hasil dengan usaha minimal.', ['boros', 'lambat', 'rumit']],
      ['persuade', 'membujuk', '/pəˈsweɪd/', 'She persuaded the committee to fund the project.', 'Persuade berarti meyakinkan orang agar mau melakukan sesuatu.', ['memaksa', 'melarang', 'mengabaikan']],
      ['significant', 'signifikan', '/sɪɡˈnɪf.ɪ.kənt/', 'The survey shows a significant change in reading habits.', 'Significant berarti cukup besar untuk diperhatikan.', ['sepele', 'sementara', 'tersembunyi']],
      ['maintain', 'merawat', '/meɪnˈteɪn/', 'The team maintains the equipment every month.', 'Maintain berarti menjaga kondisi sesuatu tetap baik.', ['membuang', 'merusak', 'mengabaikan']],
      ['observe', 'mengamati', '/əbˈzɜːv/', 'The researcher observed how students took notes.', 'Observe berarti memperhatikan dengan saksama.', ['menebak', 'melupakan', 'mengganggu']],
      ['flexible', 'fleksibel', '/ˈflek.sə.bəl/', 'The schedule is flexible enough for working students.', 'Flexible berarti mudah menyesuaikan diri.', ['kaku', 'tetap', 'sempit']],
      ['relevant', 'relevan', '/ˈrel.ə.vənt/', 'Use evidence that is relevant to the question.', 'Relevant berarti berhubungan langsung dengan topik.', ['acak', 'usang', 'asing']],
      ['sufficient', 'cukup', '/səˈfɪʃ.ənt/', 'We have sufficient time to revise the draft.', 'Sufficient berarti memadai untuk kebutuhan.', ['kurang', 'berlebih', 'kosong']],
      ['contribute', 'berkontribusi', '/kənˈtrɪb.juːt/', 'Every member contributes one idea to the plan.', 'Contribute berarti memberi bagian pada hasil bersama.', ['menghalangi', 'menikmati', 'menolak']],
      ['demonstrate', 'menunjukkan', '/ˈdem.ən.streɪt/', 'The experiment demonstrates how pressure changes volume.', 'Demonstrate berarti memperlihatkan dengan bukti atau contoh.', ['menyembunyikan', 'menebak', 'menunda']],
      ['evaluate', 'mengevaluasi', '/ɪˈvæl.ju.eɪt/', 'The teacher evaluates the draft before the final test.', 'Evaluate berarti menilai mutu sesuatu.', ['menyalin', 'memuji', 'membatalkan']],
      ['generate', 'menghasilkan', '/ˈdʒen.ə.reɪt/', 'The discussion generated three new ideas.', 'Generate berarti memunculkan atau menghasilkan.', ['menghapus', 'menahan', 'menutup']],
      ['implement', 'menerapkan', '/ˈɪm.plɪ.ment/', 'The school will implement the new policy next term.', 'Implement berarti menjalankan rencana secara nyata.', ['merancang', 'menolak', 'menunda']],
      ['justify', 'membenarkan', '/ˈdʒʌs.tɪ.faɪ/', 'You must justify your answer with evidence.', 'Justify berarti memberi alasan yang kuat.', ['menyembunyikan', 'mengulang', 'melupakan']],
      ['negotiate', 'bernegosiasi', '/nɪˈɡəʊ.ʃi.eɪt/', 'The two groups negotiated a fair deadline.', 'Negotiate berarti berunding untuk mencapai kesepakatan.', ['memaksa', 'menghindar', 'menyerah']],
      ['prioritize', 'memprioritaskan', '/praɪˈɒr.ə.taɪz/', 'Prioritize the tasks that affect the deadline.', 'Prioritize berarti menempatkan yang paling penting lebih dulu.', ['menunda', 'mengabaikan', 'menyamakan']],
      ['tolerate', 'menoleransi', '/ˈtɒl.ər.eɪt/', 'The library does not tolerate loud conversation.', 'Tolerate berarti membiarkan sesuatu yang tidak disukai.', ['melarang', 'menghukum', 'menolak']],
      ['clarify', 'memperjelas', '/ˈklær.ɪ.faɪ/', 'Could you clarify the second instruction?', 'Clarify berarti membuat sesuatu lebih jelas.', ['mengaburkan', 'mengulang', 'menyembunyikan']],
    ],
    reserve: [
      ['anticipate', 'mengantisipasi', '/ænˈtɪs.ɪ.peɪt/', 'We anticipate several questions after the talk.', 'Anticipate berarti memperkirakan sebelum terjadi.', ['melupakan', 'menyesali', 'mengulang']],
      ['allocate', 'mengalokasikan', '/ˈæl.ə.keɪt/', 'The committee allocated more time to practice.', 'Allocate berarti membagi untuk tujuan tertentu.', ['menghapus', 'meminjam', 'mencampur']],
      ['emphasize', 'menekankan', '/ˈem.fə.saɪz/', 'The coach emphasized the importance of warm-up.', 'Emphasize berarti memberi penekanan.', ['menyembunyikan', 'meremehkan', 'menunda']],
      ['interpret', 'menafsirkan', '/ɪnˈtɜː.prɪt/', 'Different readers interpret the ending differently.', 'Interpret berarti memberi makna pada sesuatu.', ['menyalin', 'menghafal', 'membatalkan']],
      ['modify', 'mengubah', '/ˈmɒd.ɪ.faɪ/', 'They modified the design after the feedback.', 'Modify berarti mengubah sebagian.', ['menjaga', 'menghapus', 'menyalin']],
      ['obtain', 'memperoleh', '/əbˈteɪn/', 'Students obtain permission before leaving early.', 'Obtain berarti mendapatkan sesuatu.', ['kehilangan', 'menolak', 'membagi']],
      ['participate', 'berpartisipasi', '/pɑːˈtɪs.ɪ.peɪt/', 'All members participate in the weekly review.', 'Participate berarti ikut ambil bagian.', ['menonton', 'menghindar', 'mengundurkan diri']],
      ['reduce', 'mengurangi', '/rɪˈdjuːs/', 'The new rule reduces paper use by half.', 'Reduce berarti membuat lebih sedikit.', ['menambah', 'menggandakan', 'mencampur']],
      ['resolve', 'menyelesaikan', '/rɪˈzɒlv/', 'The team resolved the conflict in one meeting.', 'Resolve berarti menyelesaikan masalah.', ['memperburuk', 'menunda', 'mengulang']],
      ['respond', 'menanggapi', '/rɪˈspɒnd/', 'Please respond to the invitation by Friday.', 'Respond berarti memberi jawaban atau reaksi.', ['mengabaikan', 'menanyakan', 'menunda']],
      ['restrict', 'membatasi', '/rɪˈstrɪkt/', 'The rules restrict phone use during the test.', 'Restrict berarti memberi batas.', ['memperluas', 'membebaskan', 'menambah']],
      ['retain', 'mempertahankan', '/rɪˈteɪn/', 'Good notes help you retain new vocabulary.', 'Retain berarti tetap menyimpan atau mempertahankan.', ['membuang', 'melupakan', 'membagi']],
      ['reveal', 'mengungkapkan', '/rɪˈviːl/', 'The final page reveals the real reason.', 'Reveal berarti memperlihatkan yang tadinya tersembunyi.', ['menyembunyikan', 'menutup', 'mengulang']],
      ['specify', 'merinci', '/ˈspes.ɪ.faɪ/', 'The brief specifies the length of the essay.', 'Specify berarti menyebutkan secara rinci.', ['menyamarkan', 'menebak', 'meringkas']],
      ['verify', 'memverifikasi', '/ˈver.ɪ.faɪ/', 'Verify the data before you publish the chart.', 'Verify berarti memastikan kebenaran sesuatu.', ['mengabaikan', 'menebak', 'menghapus']],
    ],
  },
  advanced: {
    published: [
      ['ambiguous', 'ambigu', '/æmˈbɪɡ.ju.əs/', 'The instruction was ambiguous, so half the class guessed.', 'Ambiguous berarti punya lebih dari satu tafsir.', ['jelas', 'tegas', 'singkat']],
      ['coherent', 'koheren', '/kəʊˈhɪə.rənt/', 'A coherent argument connects every claim to evidence.', 'Coherent berarti tersusun logis dan mudah diikuti.', ['acak', 'berbelit', 'terputus']],
      ['comprehensive', 'menyeluruh', '/ˌkɒm.prɪˈhen.sɪv/', 'The report offers a comprehensive review of the data.', 'Comprehensive berarti mencakup semua bagian penting.', ['sebagian', 'singkat', 'dangkal']],
      ['compelling', 'meyakinkan', '/kəmˈpel.ɪŋ/', 'Her closing statement was the most compelling part.', 'Compelling berarti sangat kuat sehingga sulit dibantah.', ['lemah', 'membosankan', 'ragu']],
      ['arbitrary', 'sewenang-wenang', '/ˈɑː.bɪ.trər.i/', 'The deadline felt arbitrary because no one explained it.', 'Arbitrary berarti ditentukan tanpa alasan yang jelas.', ['terukur', 'adil', 'beralasan']],
      ['meticulous', 'teliti', '/məˈtɪk.jə.ləs/', 'He kept meticulous notes of every experiment.', 'Meticulous berarti sangat cermat pada detail.', ['ceroboh', 'cepat', 'kasar']],
      ['pragmatic', 'pragmatis', '/præɡˈmæt.ɪk/', 'The principal took a pragmatic approach to the shortage.', 'Pragmatic berarti berfokus pada solusi yang benar-benar bekerja.', ['teoretis', 'idealis', 'kaku']],
      ['resilient', 'tangguh', '/rɪˈzɪl.i.ənt/', 'The community proved resilient after the flood.', 'Resilient berarti mampu pulih setelah tekanan.', ['rapuh', 'pasif', 'lemah']],
      ['subtle', 'halus', '/ˈsʌt.əl/', 'There is a subtle difference between the two graphs.', 'Subtle berarti kecil dan tidak langsung terlihat.', ['mencolok', 'kasar', 'jelas']],
      ['plausible', 'masuk akal', '/ˈplɔː.zə.bəl/', 'Her explanation is plausible but still unproven.', 'Plausible berarti tampak masuk akal.', ['mustahil', 'kacau', 'pasti']],
      ['inevitable', 'tak terhindarkan', '/ɪˈnev.ɪ.tə.bəl/', 'Some delay was inevitable given the missing data.', 'Inevitable berarti pasti terjadi dan tidak bisa dicegah.', ['mungkin', 'terduga', 'sementara']],
      ['redundant', 'berlebihan', '/rɪˈdʌn.dənt/', 'The second paragraph is redundant and can be cut.', 'Redundant berarti mengulang hal yang sudah ada.', ['penting', 'ringkas', 'baru']],
      ['profound', 'mendalam', '/prəˈfaʊnd/', 'The interview had a profound effect on her choice.', 'Profound berarti sangat dalam dan berpengaruh.', ['dangkal', 'singkat', 'biasa']],
      ['rigorous', 'ketat', '/ˈrɪɡ.ər.əs/', 'The study followed a rigorous method of sampling.', 'Rigorous berarti sangat teliti dan ketat.', ['longgar', 'cepat', 'santai']],
      ['tentative', 'sementara', '/ˈten.tə.tɪv/', 'We reached a tentative agreement on the schedule.', 'Tentative berarti belum final dan masih bisa berubah.', ['final', 'pasti', 'permanen']],
      ['versatile', 'serbaguna', '/ˈvɜː.sə.taɪl/', 'A versatile tool solves more than one problem.', 'Versatile berarti bisa dipakai untuk banyak hal.', ['khusus', 'terbatas', 'kaku']],
      ['articulate', 'fasih mengungkapkan', '/ɑːˈtɪk.jə.lət/', 'She is articulate even under pressure.', 'Articulate berarti mampu menyampaikan gagasan dengan jelas.', ['gagap', 'pendiam', 'ragu']],
      ['concise', 'ringkas', '/kənˈsaɪs/', 'Keep the summary concise, under one hundred words.', 'Concise berarti singkat tetapi tetap jelas.', ['bertele-tele', 'panjang', 'kabur']],
      ['candid', 'terus terang', '/ˈkæn.dɪd/', 'His candid feedback helped the team improve.', 'Candid berarti jujur tanpa disembunyikan.', ['berbelit', 'sopan berlebihan', 'ragu']],
      ['inherent', 'melekat', '/ɪnˈhɪə.rənt/', 'Risk is inherent in every field experiment.', 'Inherent berarti sudah menjadi bagian yang tidak terpisahkan.', ['tambahan', 'sementara', 'asing']],
    ],
    reserve: [
      ['adverse', 'merugikan', '/ˈæd.vɜːs/', 'The change had an adverse effect on attendance.', 'Adverse berarti berdampak buruk.', ['menguntungkan', 'netral', 'kecil']],
      ['cohesive', 'padu', '/kəʊˈhiː.sɪv/', 'A cohesive team shares the same working rhythm.', 'Cohesive berarti menyatu dan saling terikat.', ['terpecah', 'longgar', 'acak']],
      ['deteriorate', 'memburuk', '/dɪˈtɪə.ri.ə.reɪt/', 'Air quality deteriorated during the dry season.', 'Deteriorate berarti menjadi lebih buruk.', ['membaik', 'stabil', 'berhenti']],
      ['elaborate', 'menguraikan', '/ɪˈlæb.ə.reɪt/', 'Could you elaborate on the second finding?', 'Elaborate berarti menjelaskan lebih rinci.', ['meringkas', 'menyembunyikan', 'mengulang']],
      ['feasible', 'layak', '/ˈfiː.zə.bəl/', 'The plan is feasible within the current budget.', 'Feasible berarti mungkin dan layak dijalankan.', ['mustahil', 'mahal', 'berisiko']],
      ['impartial', 'tidak memihak', '/ɪmˈpɑː.ʃəl/', 'A judge must stay impartial throughout the debate.', 'Impartial berarti adil dan tidak memihak.', ['berat sebelah', 'tegas', 'ragu']],
      ['lucrative', 'menguntungkan', '/ˈluː.krə.tɪv/', 'The partnership turned out to be lucrative.', 'Lucrative berarti menghasilkan keuntungan besar.', ['merugikan', 'sepi', 'berisiko']],
      ['nuanced', 'bernuansa', '/ˈnjuː.ɑːnst/', 'The essay offers a nuanced view of the policy.', 'Nuanced berarti peka terhadap perbedaan halus.', ['kasar', 'hitam-putih', 'dangkal']],
      ['obsolete', 'usang', '/ˌɒb.səˈliːt/', 'The old format became obsolete after the update.', 'Obsolete berarti tidak lagi dipakai karena ketinggalan.', ['modern', 'baru', 'populer']],
      ['pervasive', 'meresap luas', '/pəˈveɪ.sɪv/', 'The habit is pervasive across all grade levels.', 'Pervasive berarti tersebar hampir di semua tempat.', ['terbatas', 'langka', 'lokal']],
      ['prevalent', 'lazim', '/ˈprev.əl.ənt/', 'The error is prevalent among first-year students.', 'Prevalent berarti umum terjadi pada suatu kelompok.', ['langka', 'unik', 'baru']],
      ['scrutinize', 'meneliti dengan cermat', '/ˈskruː.tɪ.naɪz/', 'The panel scrutinized every line of the proposal.', 'Scrutinize berarti memeriksa dengan sangat teliti.', ['mengabaikan', 'membaca cepat', 'menyalin']],
      ['substantiate', 'membuktikan', '/səbˈstæn.ʃi.eɪt/', 'You need data to substantiate that claim.', 'Substantiate berarti mendukung dengan bukti.', ['membantah', 'menebak', 'mengulang']],
      ['unprecedented', 'belum pernah terjadi', '/ʌnˈpres.ɪ.den.tɪd/', 'The school recorded unprecedented attendance this term.', 'Unprecedented berarti belum pernah ada sebelumnya.', ['biasa', 'berulang', 'terduga']],
      ['viable', 'dapat dijalankan', '/ˈvaɪ.ə.bəl/', 'Solar power is a viable option for the lab.', 'Viable berarti mampu bekerja dan bertahan.', ['mustahil', 'gagal', 'mahal']],
    ],
  },
}

function rotate(items, shift) {
  const offset = shift % items.length
  return [...items.slice(offset), ...items.slice(0, offset)]
}

function cardDocument(level, entry, index, status) {
  const [word, meaning, ipa, example, tip, distractors] = entry
  const options = rotate([meaning, ...distractors], index)
  return {
    contentType: 'vocabulary',
    skill: 'vocabulary',
    level,
    word,
    meaning,
    ipa,
    example,
    tip,
    prompt: `Apa arti kata “${word}”?`,
    options,
    correctOption: options.indexOf(meaning),
    explanation: `“${word}” berarti ${meaning}.`,
    tags: status === 'published' ? ['vocabulary', level] : ['vocabulary', level, 'reserve'],
    status,
    createdAt: now,
    updatedAt: now,
  }
}

const documents = []
for (const [level, groups] of Object.entries(BANK)) {
  groups.published.forEach((entry, index) => {
    const id = `vocabulary-${level}-${String(index + 1).padStart(2, '0')}`
    documents.push({ id, data: cardDocument(level, entry, index, 'published') })
  })
  groups.reserve.forEach((entry, index) => {
    const id = `vocabulary-${level}-reserve-${String(index + 1).padStart(2, '0')}`
    documents.push({ id, data: cardDocument(level, entry, index + 2, 'draft') })
  })
}

const existing = await db.collection('questionBank').where('contentType', '==', 'vocabulary').get()
const authoredIds = new Set(documents.map((document) => document.id))
const stale = existing.docs.filter((doc) => !authoredIds.has(doc.id) && doc.data().status !== 'archived')

const operations = [
  ...documents.map((document) => ({ type: 'set', id: document.id, data: document.data })),
  ...stale.map((doc) => ({ type: 'update', id: doc.id, data: { status: 'archived', updatedAt: now } })),
]

for (let index = 0; index < operations.length; index += 400) {
  const batch = db.batch()
  for (const operation of operations.slice(index, index + 400)) {
    const reference = db.collection('questionBank').doc(operation.id)
    if (operation.type === 'set') batch.set(reference, operation.data)
    else batch.update(reference, operation.data)
  }
  await batch.commit()
}

const published = documents.filter((document) => document.data.status === 'published')
const summary = {
  authored: documents.length,
  published: published.length,
  reserve: documents.length - published.length,
  perLevel: Object.fromEntries(
    Object.keys(BANK).map((level) => [level, published.filter((document) => document.data.level === level).length]),
  ),
  archived: stale.map((doc) => doc.id),
}
console.log(JSON.stringify(summary, null, 2))
