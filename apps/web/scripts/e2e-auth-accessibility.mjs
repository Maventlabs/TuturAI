import { chromium } from 'playwright'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'
const suffix = Date.now()
const password = 'E2eAccessibilityPassword123!'
const fixtures = [
  { id: `e2e-accessibility-student-${suffix}`, email: `e2e-accessibility-student-${suffix}@example.test`, displayName: 'E2E Accessibility Student', role: 'student', route: '/siswa' },
  { id: `e2e-accessibility-teacher-${suffix}`, email: `e2e-accessibility-teacher-${suffix}@example.test`, displayName: 'E2E Accessibility Teacher', role: 'teacher', route: '/guru' },
]

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this script with Firebase Auth and Firestore emulators; it must not use production accounts.')
}

const app = getApps()[0] ?? initializeApp({ projectId })
const auth = getAuth(app)
const db = getFirestore(app)
const createdFixtureIds = []
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 375, height: 812 } })

async function loginWith(page, email, password, route) {
  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata Sandi').fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((url) => url.pathname === route || url.pathname.startsWith(`${route}/`), { timeout: 15_000 })
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  if (dimensions.content > dimensions.viewport) {
    throw new Error(`${label} overflows horizontally: ${JSON.stringify(dimensions)}`)
  }
}

try {
  for (const fixture of fixtures) {
    await auth.createUser({ uid: fixture.id, email: fixture.email, password, displayName: fixture.displayName })
    createdFixtureIds.push(fixture.id)
    await db.collection('users').doc(fixture.id).set({
      id: fixture.id,
      email: fixture.email,
      displayName: fixture.displayName,
      role: fixture.role,
      school: 'E2E',
      className: null,
      subject: fixture.role === 'teacher' ? 'English' : null,
      xp: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  }

  await page.goto(`${baseURL}/auth/login`)
  await page.keyboard.press('Tab')
  const firstFocus = await page.evaluate(() => {
    const active = document.activeElement
    const style = active ? getComputedStyle(active) : null
    return { tag: active?.tagName, outline: style?.outlineStyle, boxShadow: style?.boxShadow }
  })
  if (!firstFocus.tag || (firstFocus.outline === 'none' && firstFocus.boxShadow === 'none')) {
    throw new Error(`Keyboard focus is not visibly indicated: ${JSON.stringify(firstFocus)}`)
  }
  await page.getByLabel('Email').fill('a11y-unknown@example.test')
  await page.getByLabel('Kata Sandi').fill('IncorrectPassword123!')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()

  const loginError = page.getByText('Login gagal.', { exact: false })
  await loginError.waitFor()

  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    errorText: [...document.querySelectorAll('p')].find((element) => element.textContent?.includes('Login gagal.'))?.textContent?.trim() ?? '',
    errorRole: [...document.querySelectorAll('p')].find((element) => element.textContent?.includes('Login gagal.'))?.getAttribute('role'),
    errorLive: [...document.querySelectorAll('p')].find((element) => element.textContent?.includes('Login gagal.'))?.getAttribute('aria-live'),
  }))
  if (layout.documentWidth > layout.viewportWidth) {
    throw new Error(`Login page overflows at 375px: ${JSON.stringify(layout)}`)
  }
  if (layout.errorRole !== 'alert' && layout.errorLive !== 'assertive') {
    throw new Error(`Visible login error was not announced to assistive technology: ${JSON.stringify(layout)}`)
  }
  await assertNoHorizontalOverflow(page, 'Login at 375px')

  const firstHeading = await page.locator('main h1, main h2, main h3, main h4, main h5, main h6').first().evaluate((element) => element.tagName)
  if (firstHeading !== 'H1') {
    throw new Error(`Auth page begins with ${firstHeading} before its main heading`)
  }

  await loginWith(page, fixtures[0].email, password, '/siswa')
  await assertNoHorizontalOverflow(page, 'Student dashboard at 375px')
  const studentCurrentLinks = await page.evaluate(() => [...document.querySelectorAll('nav a[aria-current="page"]')]
    .filter((link) => link.getClientRects().length > 0)
    .map((link) => link.getAttribute('href')))
  if (!studentCurrentLinks.includes('/siswa')) {
    throw new Error(`Student current page is not identified in navigation: ${JSON.stringify(studentCurrentLinks)}`)
  }

  const undersizedLinks = await page.evaluate(() => [...document.querySelectorAll('main a')]
    .map((link) => ({ label: link.textContent?.trim(), rect: link.getBoundingClientRect() }))
    .filter(({ label, rect }) => ['Buka', 'Lihat semua'].includes(label) && (rect.width < 24 || rect.height < 24))
    .map(({ label, rect }) => ({ label, width: Math.round(rect.width), height: Math.round(rect.height) })))
  if (undersizedLinks.length) {
    throw new Error(`Student dashboard links are below WCAG 2.2 target size: ${JSON.stringify(undersizedLinks)}`)
  }

  await page.getByRole('button', { name: 'Buka menu' }).click()
  await page.getByRole('dialog').waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  const focusedAfterClose = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
  if (focusedAfterClose !== 'Buka menu') {
    throw new Error(`Mobile navigation did not restore focus to its trigger: ${String(focusedAfterClose)}`)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await assertNoHorizontalOverflow(page, 'Student dashboard at 1440px')
  const desktopStudentCurrent = await page.evaluate(() => [...document.querySelectorAll('nav a[aria-current="page"]')]
    .filter((link) => link.getClientRects().length > 0)
    .map((link) => link.getAttribute('href')))
  if (!desktopStudentCurrent.includes('/siswa')) {
    throw new Error(`Desktop student navigation lost current-page state: ${JSON.stringify(desktopStudentCurrent)}`)
  }

  const teacherPage = await browser.newPage({ viewport: { width: 375, height: 812 } })
  await loginWith(teacherPage, fixtures[1].email, password, '/guru')
  await assertNoHorizontalOverflow(teacherPage, 'Teacher dashboard at 375px')
  await teacherPage.getByRole('button', { name: 'Buka menu' }).click()
  const teacherMenu = teacherPage.getByRole('dialog')
  await teacherMenu.waitFor()
  const teacherCurrent = teacherMenu.locator('a[aria-current="page"]')
  await teacherCurrent.waitFor()
  if (await teacherCurrent.getAttribute('href') !== '/guru') {
    throw new Error('Teacher navigation does not identify its current page')
  }
  await teacherPage.keyboard.press('Escape')
  await teacherMenu.waitFor({ state: 'hidden' })
  await teacherPage.setViewportSize({ width: 1440, height: 900 })
  await assertNoHorizontalOverflow(teacherPage, 'Teacher dashboard at 1440px')
  const desktopTeacherCurrent = await teacherPage.evaluate(() => [...document.querySelectorAll('nav a[aria-current="page"]')]
    .filter((link) => link.getClientRects().length > 0)
    .map((link) => link.getAttribute('href')))
  if (!desktopTeacherCurrent.includes('/guru')) {
    throw new Error(`Desktop teacher navigation lost current-page state: ${JSON.stringify(desktopTeacherCurrent)}`)
  }
  await teacherPage.close()

  console.log(JSON.stringify({ ok: true, visibleKeyboardFocus: true, loginErrorAnnounced: true, authHeadingOrder: true, studentAndTeacherNavigation: true, dashboardTouchTargets: true, mobileWidth: 375, desktopWidth: 1440 }))
} finally {
  await browser.close()
  for (const userId of createdFixtureIds) {
    await db.collection('users').doc(userId).delete()
    try {
      await auth.deleteUser(userId)
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') throw error
    }
  }
}
