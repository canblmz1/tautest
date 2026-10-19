import { expect, it } from 'vitest'
import { TodoTitle } from '../../../src/domain/todo-title.js'

it('accepts a title of exactly 255 characters', () => {
  const title = 'a'.repeat(255)
  expect(TodoTitle.fromString(title).toString()).toBe(title)
})
