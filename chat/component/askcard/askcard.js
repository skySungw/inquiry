import { ajax2 } from "../../../../../utils/util.js";
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    inquiryInfo: {
      type: Object,
      value: {},
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    selfHeadDefault0: '../../images/self_head_default0@2x.png',
    selfHeadDefault1: '../../images/self_head_default1@2x.png',
  },

  ready() {
    console.log('askcard--', this.properties.inquiryInfo);
  },

  /**
   * 组件的方法列表
   */
  methods: {
    getUserInformation(_inquiryId) {
      console.log(_inquiryId, '微信小程序中调用子组件的方法')
      let reqData = {
        inquiryId: _inquiryId
      };
      let _this = this;
      let reqUrl = "api/chat/inquiry/getstatus";
      ajax2('post', reqUrl, reqData, (res) => {
        console.log(res.data, '极速问诊卡片组件')
        if (res.data.code == 0) {
          _this.setData({ inquiryInfo: res.data.result })
        } else {
          console.log(res.data.msg, 'xiaochacha')
          wx.showToast({
            icon: 'none',
            title: res.data.msg
          })
        }
      });
    }

  }
})
