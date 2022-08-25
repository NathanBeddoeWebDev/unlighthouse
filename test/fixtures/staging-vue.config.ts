export default {
  site: 'https://vuejs.org/',
  debug: true,
  scanner: {
    device: "mobile",
    throttle: true,
    samples: 3,
    customSampling: {
      '/guide/(.*?)': {
        name: 'guide'
      }
    }
  },
}
