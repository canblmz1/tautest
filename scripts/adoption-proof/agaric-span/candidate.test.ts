import { expect, it } from 'vitest'

import { tokenize } from '@/lib/search-query/tokenize'

it('preserves the UTF-16 span of a word with an unclosed embedded quote', () => {
  const input = '  prop:key="unterminated value'
  const [word] = tokenize(input)
  expect(word).toMatchObject({
    kind: 'word',
    text: 'prop:key="unterminated',
    span: [2, 24],
    unclosedQuote: true,
  })
})
