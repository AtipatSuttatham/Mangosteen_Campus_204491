/**
 * ตัวช่วยของ test หน้ารายวิชา (ขั้น 3.6) — ข้อมูลสมมติ + วาดหน้า /courses/:courseId
 * ใช้เฉพาะใน test (ไฟล์ *.test.tsx) — ไม่ถูกรวมในหน้าเว็บจริง
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { Course } from '../../api/courses'
import type { AddStudentsResult, EnrolledStudent, Enrollment, Roster } from '../../api/enrollments'
import CoursePage from './CoursePage'
import StudentsTab from './StudentsTab'

export function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 5,
    academic_year: 2569,
    semester: 1,
    code: '204111',
    name: 'Python พื้นฐาน',
    description: 'คำอธิบาย',
    teacher: { id: 7, first_name: 'กมล', last_name: 'ศรีวงศ์', is_active: true },
    is_closed: false,
    is_published: true,
    join_code_enabled: true,
    join_code: 'K7Q2XM9A',
    student_count: 2,
    can_delete: false,
    closed_at: null,
    closed_by: null,
    created_at: '2026-06-01T03:00:00Z',
    ...overrides,
  }
}

export function makeStudent(id: number, overrides: Partial<EnrolledStudent> = {}): EnrolledStudent {
  return {
    id,
    first_name: `ชื่อ${id}`,
    last_name: `สกุล${id}`,
    email: `s${id}@example.com`,
    student_or_staff_id: `67051${id}`,
    is_active: true,
    ...overrides,
  }
}

export function makeEnrollment(id: number, overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id,
    student: makeStudent(id),
    status: 'active',
    method: 'join_code',
    enrolled_at: '2026-06-03T03:12:00Z',
    dropped_at: null,
    ...overrides,
  }
}

export function roster(results: Enrollment[], counts = { active: results.length, dropped: 0 }): Roster {
  return { count: results.length, next: null, previous: null, results, counts }
}

export const emptyResult: AddStudentsResult = { added: [], reactivated: [], already: [], failed: [] }

/** วาดหน้ารายวิชาในแผนที่หน้าเหมือนของจริง (ส่งเนื้อหาแท็บตั้งค่าเข้ามาเมื่อต้องทดสอบแท็บนั้น) */
export function renderCoursePage(path = '/courses/5', settings: ReactNode = null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/courses', element: <p>หน้ารายวิชาของฉัน</p> },
      {
        path: '/courses/:courseId',
        element: <CoursePage />,
        children: [
          { index: true, element: <StudentsTab /> },
          { path: 'settings', element: settings },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), router }
}
