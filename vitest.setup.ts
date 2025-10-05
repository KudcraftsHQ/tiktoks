import { beforeAll, afterAll, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

beforeAll(() => {
  // Setup before all tests
})

afterEach(() => {
  // Cleanup after each test
  cleanup()
})

afterAll(() => {
  // Cleanup after all tests
})
