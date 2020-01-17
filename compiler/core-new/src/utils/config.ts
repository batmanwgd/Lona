import * as path from 'path'
import * as fs from 'fs'
import * as serialization from '@lona/serialization'

import * as fileSearch from './file-search'

type LonaJSON = {
  ignore: string[]
}

export type Config = {
  version: string
  workspacePath: string
  componentPaths: string[]
  documentPaths: string[]
  logicPaths: string[]
  logicFiles: { [filePath: string]: serialization.LogicAST.SyntaxNode }
} & LonaJSON

export function load(workspacePath: string): Promise<Config>
export function load(
  workspacePath: string,
  options: {
    forEvaluation: boolean
    fs: { readFile(filePath: string): Promise<string> }
  }
): Promise<Config>
export async function load(
  workspacePath: string,
  options?: {
    forEvaluation?: boolean
    fs?: { readFile(filePath: string): Promise<string> }
  }
): Promise<Config> {
  const rootDirname = path.dirname(path.dirname(__dirname))
  console.error(`Running compiler from: ${rootDirname}`)

  const lonaFile = JSON.parse(
    await fs.promises.readFile(path.join(workspacePath, 'lona.json'), 'utf-8')
  ) as LonaJSON

  if (!lonaFile.ignore) {
    lonaFile.ignore = ['node_modules', '.git']
  }

  const componentPaths = fileSearch.sync(
    path.join(workspacePath, '**/*.component'),
    lonaFile
  )
  const documentPaths = fileSearch.sync(
    path.join(workspacePath, '**/*.md'),
    lonaFile
  )
  const logicPaths = fileSearch.sync(
    path.join(workspacePath, '**/*.logic'),
    lonaFile
  )

  const logicFiles = {}

  if (options && options.forEvaluation) {
    await Promise.all(
      logicPaths
        .map(x =>
          options.fs
            .readFile(x)
            .then(data => serialization.decodeLogic(data))
            .then(ast => (logicFiles[x] = ast))
        )
        .concat(
          documentPaths.map(x =>
            options.fs
              .readFile(x)
              .then(data => serialization.extractProgramAST(data))
              .then(ast => (logicFiles[x] = ast))
          )
        )
    )
  }

  return {
    ...lonaFile,
    workspacePath,
    componentPaths,
    documentPaths,
    logicPaths,
    logicFiles,
    version: require('../../package.json').version,
  }
}
