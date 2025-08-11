import { expect, test } from 'vitest'
import { getUserTheme } from '../src'

test('getUserTheme returns null outside VS Code', async () => {
  const result = await getUserTheme()
  expect(result).toBeNull()
})
