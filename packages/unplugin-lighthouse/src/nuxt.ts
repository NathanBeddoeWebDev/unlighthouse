import { join, resolve, relative } from 'path'
import fs from 'fs'
import {addServerMiddleware, addVitePlugin, addWebpackPlugin, requireModulePkg} from '@nuxt/kit'
import { $fetch } from 'ohmyfetch'
import NuxtModuleUtils from 'nuxt-kit-extras'
import { Options } from './types'
import {defaultOptions, formatBytes, NAME, NUXT_CONFIG_KEY, PLUGIN_PATH_PREFIX} from './core'
import { createApi } from './node/server'
import { usesClusterForRouteProcessing } from './node/composition/usesClusterForRouteProcessing'
import logger from './core/logger'
import unplugin from './index'
import {
  defineNuxtModule,
} from '@nuxt/kit'
import { version } from '../package.json'

export default defineNuxtModule<Options>(nuxt => ({
  name: NAME,
  version,
  configKey: NUXT_CONFIG_KEY,
  defaults: defaultOptions,
  async setup(data) {

    const options = data as Options

    const { rootDir, server } = nuxt

    if (!options.host) {
      options.host = `http${server.https ? 's' : ''}://${server.host}:${server.port}`
    }

    const { processRoute, reports, processRoutes, runningTasks, hasStarted } = await usesClusterForRouteProcessing(options)

    const { addMiddleware, addStartCliBadgeLink, getRoutes } = NuxtModuleUtils.call(nuxt)
    //
    addMiddleware({
      name: 'lighthouse-route-logger',
      src: resolve(join(__dirname, 'providers', 'nuxt', 'template', 'middleware', 'logRoute.js')),
      dst: 'lighthouse/logRoute.js',
      options,
    })

    nuxt.options.build.transpile.push('ohmyfetch')

    // @todo implement watcher
    // nuxt.hook('watch:restart', (event: WatchEvent, path: string) => {
    //   console.log('watch', event, path)
    // })
    //
    // nuxt.hook('bundler:change', (changedFileName) => {
    //   console.log('file change', changedFileName)
    // })

    // nuxt.hook('build:done', () => {
    //   console.log('ready hook')
    // })

    nuxt.options.ignore.push('.lighthouse')

    if (!fs.existsSync(options.outputPath))
      fs.mkdirSync(options.outputPath)

    addStartCliBadgeLink(PLUGIN_PATH_PREFIX, 'Routes')

    const runtimeModuleCount = nuxt.options.modules.length
    const buildModuleCount = nuxt.options.buildModules.length

    const onAppVisit = async() => {
      // has started processing
      if (hasStarted())
        return
      // maybe start processing routes once they visit the app
      const routes = await getRoutes()
      processRoutes(routes)
      logger.info(`Started processing with ${routes.length} static routes.`)
    }

    const api = createApi({
      processRoute,
      onAppVisit,
      routes: getRoutes,
      async reports() {
        await onAppVisit()
        return reports().map((report) => {
          if (report.route.component)
            report.route.component = relative(rootDir, report.route.component)

          return report
        })
      },
      async stats() {
        const routes = await getRoutes()
        let appBytes = '0B'
        try {
          const { headers } = await $fetch.raw('http://localhost:3000/_nuxt/app.js')
          appBytes = formatBytes(Number.parseInt(headers.get('content-length') || '0'))
        }
        catch (e) {
          // do nothing
        }

        let vendorBytes = '0B'
        try {
          const { headers } = await $fetch.raw('http://localhost:3000/_nuxt/vendors/app.js')
          vendorBytes = formatBytes(Number.parseInt(headers.get('content-length') || '0'))
        }
        catch (e) {
          // do nothing
        }

        let commonsBytes = '0B'
        try {
          const { headers } = await $fetch.raw('http://localhost:3000/_nuxt/commons/app.js')
          commonsBytes = formatBytes(Number.parseInt(headers.get('content-length') || '0'))
        }
        catch (e) {
          // do nothing
        }
        const data = reports()
        let score = 0
        if (data && data.length > 0) {
          // @ts-ignore
          score = data
              .map(r => r.score)
              // @ts-ignore
              .reduce((s, a) => s + a, 0) / data.length
        }

        return {
          runtimeModuleCount,
          buildModuleCount,
          score,
          framework: [
            {
              id: 'nuxt',
              name: 'Nuxt.js',
              version: requireModulePkg('nuxt').version,
            },
            {
              id: 'vue',
              name: 'Vue.js',
              version: requireModulePkg('vue').version,
            },
            {
              id: 'windicss',
              icon: 'simple-icons-windicss',
              name: 'WindiCSS',
              version: requireModulePkg('windicss').version,
            },
          ],
          staticRoutes: routes.filter(route => !route.path.includes(':')).length,
          dynamicRoutes: routes.filter(route => route.path.includes(':')).length,
          runningTasks: runningTasks(),
          modules: {
            app: {
              size: appBytes,
            },
            vendor: {
              size: vendorBytes,
            },
            commons: {
              size: commonsBytes,
            },
          },
        }
      },
    })

    addServerMiddleware({
      handler: api,
    })

    addWebpackPlugin(unplugin.webpack(options))
    addVitePlugin(unplugin.vite(options))
  },
})
