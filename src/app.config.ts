export default defineAppConfig({
  pages: [
    'pages/routes/index',
    'pages/scan/index',
    'pages/fault/index',
    'pages/rectify/index',
    'pages/stats/index',
    'pages/point-detail/index',
    'pages/device-detail/index',
    'pages/fault-detail/index',
    'pages/summary/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#165dff',
    navigationBarTitleText: '资产巡检',
    navigationBarTextStyle: 'white'
  },
  tabBar: {
    color: '#86909c',
    selectedColor: '#165dff',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/routes/index',
        text: '巡检路线'
      },
      {
        pagePath: 'pages/scan/index',
        text: '扫码记录'
      },
      {
        pagePath: 'pages/fault/index',
        text: '故障上报'
      },
      {
        pagePath: 'pages/rectify/index',
        text: '整改跟踪'
      },
      {
        pagePath: 'pages/stats/index',
        text: '个人统计'
      }
    ]
  }
})
