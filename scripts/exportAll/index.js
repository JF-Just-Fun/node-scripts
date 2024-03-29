#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url')

function isTypeScriptProject(projectDir) {
  if (!projectDir) {
    console.log('require project dir!!!')
    return false
  }

  // 获取 package.json 文件
  const packageJsonPath = path.resolve(projectDir, 'package.json');
  const packageJsonExists = fs.existsSync(packageJsonPath);
  let hasTypeScriptInPackageJson = false;

  if (packageJsonExists) {
    const packageData = fs.readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageData);
    // 检查 package.json 中是否有 typescript 依赖
    hasTypeScriptInPackageJson = packageJson.dependencies?.typescript || packageJson.devDependencies?.typescript;
  }

  // 检查是否有 tsconfig.json 文件
  const hasTsConfig = fs.existsSync(path.join(projectDir, 'tsconfig.json'));

  return hasTypeScriptInPackageJson || hasTsConfig;
}

/**
 * 基于resolve(projectPath, srcPath)的路径，自动将该文件夹下的所有文件导出，合并到项目根目录下的index.js或index.ts中
 *
 * 例如：在根目录下 projectPath=__dirname srcPath='./src'
 *
 * 则会将./src中的所有index.js或index.ts的遍历一遍，获取所有导出并生成./index.js或./index.ts
 *
 * @param {string | Array} projectPath 当前项目路径一般以project.json的所在目录为准
 * @param {string} srcPath 基于projectPath的相对路径
 * @param {string} targetPath optional 基于projectPath的相对路径
 * @param {'esm' | 'cjs'} mode optional 模块化规范
 * @returns void
 */
module.exports = function (projectPath, srcPath, targetPath = './', mode = "esm") {
  if (!['esm', 'cjs'].includes(mode)) {
    console.log('mode must be esm or cjs!!!')
    return
  }

  if (Array.isArray(projectPath)) projectPath = path.resolve(...projectPath)

  srcPath = srcPath.trim().replace(/\/$/, '').trim()
  if (!srcPath.startsWith('./') && !srcPath.startsWith('../')) {
    srcPath = './' + srcPath
  }

  const isTS = isTypeScriptProject(projectPath)
  const indexFileName = isTS ? 'index.ts' : 'index.js'

  const filePath = path.resolve(projectPath, targetPath)
  const srcDir = path.resolve(projectPath, srcPath)
  const relativePath = path.relative(filePath, srcDir)

  if (!fs.existsSync(srcDir)) {
    console.log(`no such file or directory!!!\n=> ${srcDir}`);
    return
  }

  const files = fs.readdirSync(srcDir)
  const exportContent = files.reduce((content, file) => {
    const fileDir = path.resolve(srcDir, file)
    if (fs.statSync(fileDir).isDirectory()) {
      const indexTS = fs.existsSync(path.resolve(fileDir, 'index.ts'));
      const indexJS = fs.existsSync(path.resolve(fileDir, 'index.js'));

      const indexFilePaths = []
      if (indexTS) {
        indexFilePaths.push(path.resolve(fileDir, 'index.ts'))
      }
      if (indexJS) {
        indexFilePaths.push(path.resolve(fileDir, 'index.js'))
      }

      indexFilePaths.forEach(indexFilePath => {
        // 读取文件内容
        const fileContent = fs.readFileSync(indexFilePath, 'utf-8');
        let exportPath = path.join('./', relativePath, file).replaceAll('\\', '\/')
        if (!exportPath.startsWith('.')) exportPath = './' + exportPath

        if (mode === 'esm') {
          content += `export * from '${exportPath}';\n`

          // 读取文件内容
          const hasDefaultExport = fileContent.includes('export default')
          if (hasDefaultExport) {
            content += `export { default as ${file} } from '${exportPath}';\n`
          }
        } else {
          content += `module.exports.${file} = require('${exportPath}');\n`
        }
      })
    } else {
      // todo: 读取文件内容，并输出所有导出
      console.log('=> file', fileDir);
    }

    return content
  }, '')

  if (!fs.existsSync(filePath)) fs.mkdirSync(filePath, { recursive: true });
  fs.writeFileSync(path.resolve(filePath, indexFileName), exportContent, 'utf-8');
}
