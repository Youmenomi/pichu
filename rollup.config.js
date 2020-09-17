//@ts-check

import { build } from 'rollup-simple-configer'
import pkg from './package.json'

const input = './src/index.ts'

export default [].concat(
  build(input, {
    file: pkg.main,
    format: 'cjs',
  }),
  build(input, {
    file: pkg.module,
    format: 'esm',
  }),
  build(
    input,
    {
      file: 'dist/umd/pichu.umd.js',
      format: 'umd',
      name: 'pichu',
    },
    { withMin: true }
  )
)
