Component({
  /**
   * 组件的属性列表
   */
  properties: {
    rate: {
      type: String,
      value: ''
    }
  },
  /**
   * 组件的初始数据
   */
  data: {
    rateText: '',
    rateTexts: {
      '1': '非常不满意',
      '2': '不满意',
      '3': '一般',
      '4': '满意',
      '5': '非常满意',
    },
    isRate: null,
    myRate: 0
  },
  observers: {
    rate() {
      this.setData({
        myRate: this.data.rate,
      })
      if (this.data.rate || this.data.rate === 0) {
        this.setData({
          isRate: this.data.rate > 0? '2':'1'
        })
      }
    },
    myRate() {
      this.setData({
        rateText: this.data.rateTexts[this.data.myRate]
      })
    }
  },
  lifetimes: {

  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 改变评价分
    onChangRate(e) {
      this.setData({
        myRate: e.currentTarget.dataset.index
      })
    },
    // 提交
    onSub(e) {
      if (this.data.myRate === '0') {
        wx.showToast({
          title: '请选择评分',
          icon: 'none',
          duration: 2000
        })
        return
      }
      this.triggerEvent('sub', e.currentTarget.dataset.rate)
    } 
  }
})
