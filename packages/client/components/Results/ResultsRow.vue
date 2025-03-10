<script lang="ts" setup>
import type { UnlighthouseRouteReport } from '@unlighthouse/core'
import { dynamicSampling } from '../../logic'

const props = defineProps<{
  routeName: string
  reports: UnlighthouseRouteReport[]
}>()

const { reports } = toRefs(props)

const reportsScore = computed(() => {
  return Math.round(reports.value.map(c => c.report?.score).reduce((s, a) => s + a, 0) / reports.value.length * 100) / 100
})
</script>

<template>
  <div>
    <disclosure-handle>
      <template #label>
        <div class="grid grid-cols-12 gap-4 text-xs w-full">
          <div class="flex items-center justify-between col-span-4 lg:col-span-3 xl:col-span-2">
            <span>{{ routeName }}</span>
            <span v-if="dynamicSampling && reports.length >= dynamicSampling">
              <tooltip>
                <span class="whitespace-nowrap ml-2 opacity-90">Sampled routes</span>
                <template #tooltip>
                  <p>The <code>scanner.dynamicSampling</code> is enabled and set to {{ dynamicSampling }}. Consider disabling sampling or increase the sampling amount if</p>
                </template>
              </tooltip>
            </span>
          </div>
          <div class="items-center col-span-2 hidden lg:flex">
            <metric-guage v-if="reportsScore" :score="reportsScore" :stripped="true" />
          </div>
        </div>
      </template>
      <template v-for="(report, index) in reports" :key="index">
        <results-route :report="report">
          <template #actions>
            <slot v-if="report?.report" name="actions" :report="report" />
          </template>
        </results-route>
      </template>
    </disclosure-handle>
  </div>
</template>
