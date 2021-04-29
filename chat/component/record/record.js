let WebIM = wx.WebIM = require("../../../../../im/utils/WebIM")["default"];
Component({
  properties: {
    userInfo: {
      type: Object,
      value: {},
    },
    chatType: {
      type: String,
      value: 'singleChat',
    },
    inquiryInfo: {
      type: Object,
      value: {}
    }
  },
  data: {
    changedTouches: null,
    recordStatus: 1,
    recordStatusConfig: {
      SHOW: 0,
      HIDE: 1,
      HOLD: 2,
      SWIPE: 3,
      RELEASE: 4
    },
    recordDesc: { 
      0: "长按开始录音",
      2: "向上滑动取消",
      3: "松开手取消",  
    },
    recordClicked: false,
    runAnimation: false,
    recorderManager: wx.getRecorderManager(),
    radomHeight: []
  },
  methods: {
    /**
     * 阻止冒泡事件
     */
    toggleWithoutAction(e) {},
    /**
     * 录音组件显示的状态
     * 组件方法调用在 inputbar 中
     */
    toggleRecordModal() {
      let recordStatus = this.data.recordStatus;
      let recordStatusConfig = this.data.recordStatusConfig
      let isShowRecordStatus = ( recordStatus == recordStatusConfig.HIDE) ? recordStatusConfig.SHOW : recordStatusConfig.HIDE
      this.setData({
        runAnimation: false,
        recordStatus: isShowRecordStatus,
        radomHeight: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
      });
    },
    /**
     * 获取当前录音的点击区域
     * 超出区域取消录音
     * @params { e } 事件参数
     */
    handleRecordingMove(e) {

      let touches = e.touches[0];
      let changedTouches = this.data.changedTouches;
      let recordStatus = this.data.recordStatus;
      let recordStatusConfig = this.data.recordStatusConfig

      if (!changedTouches) {
        return false;
      }
      // 松开手取消录音
      if (recordStatus == recordStatusConfig.SWIPE) {
        if (changedTouches.pageY - touches.pageY < 20) {
          this.setData({
            recordStatus: recordStatusConfig.HOLD
          });
        }
      }
      // 向上滑动取消
      if (recordStatus == recordStatusConfig.HOLD) {
        if (changedTouches.pageY - touches.pageY > 20) {
          this.setData({
            recordStatus: recordStatusConfig.SWIPE
          });
        }
      }
    },
    /**
     * 开始录音函数
     * @params { e } 事件参数
     * @func getRecordAuthSetting 调用授权
     * @func getStartRecordEvent 开始录音
     */
    handleRecording(e) {
      let _this = this;
      console.log('handleRecording')
      _this.setData({ recordClicked: true })
      setTimeout(() => {
        if (_this.data.recordClicked == true) {
          _this.getRecordAuthSetting(e)
        }
      }, 350)
    },
    /**
     * 取消录音
     */
    handleRecordingCancel() {
      console.log('handleRecordingCancel')
      this.data.runAnimation = false
      let recorderManager = this.data.recorderManager;
      let recordStatusConfig = this.data.recordStatusConfig;
      // 向上滑动状态停止：取消录音发放
      if (this.data.recordStatus == recordStatusConfig.SWIPE) {
        this.setData({
          recordStatus: recordStatusConfig.RELEASE
        });
      } else {
        this.setData({
          recordStatus: recordStatusConfig.HIDE,
          recordClicked: false
        });
      }
      // 录制录音条件满足发送消息并上传录音文件
      recorderManager.onStop((res) => {
        if (this.data.recordStatus == recordStatusConfig.RELEASE) {
          this.setData({
            recordStatus: recordStatusConfig.HIDE
          });
          return false;
        }
        if (res.duration < 1000) {
        console.log('handleRecordingCancel 111')
          wx.showToast({
            title: "录音时间太短",
            icon: "none"
          })
        } else {
        console.log('handleRecordingCancel 222')
          // 上传录音文件
          console.log('record tempFilePath:', res.tempFilePath)
          this.setUploadRecord(res.tempFilePath, res.duration);
        }
      });
      // 停止录音
      recorderManager.stop();
    },
    /**
     * 上传录音
     * @params { tempFilePath } 文件临时路径
     * @prams { dur } 录音时间
     */
    setUploadRecord(tempFilePath, dur) {
      let _this = this;
      let str = WebIM.config.appkey.split("#");
      let token = WebIM.conn.context.accessToken
      // 调用微信上传 api
      wx.uploadFile({
        url: "https://a1.easemob.com/" + str[0] + "/" + str[1] + "/chatfiles",
        filePath: tempFilePath,
        name: "file",
        header: {
          "Content-Type": "multipart/form-data",
          Authorization: "Bearer " + token
        },
        success(res) {
          // 当前用户信息
          let userInfo = wx.getStorageSync("userEasemoInfo");
          // 医生信息
          // let doctorInfo = wx.getStorageSync("doctorInfo");
          // 获取 id
          let id = WebIM.conn.getUniqueId();
          // 设置消息类型
          let msg = new WebIM.message('audio', id);
          let dataObj = JSON.parse(res.data);
          // 设置消息对象
          msg.set({
            apiUrl: WebIM.config.apiURL,
            accessToken: token,
            body: {
              type: 'audio',
              url: dataObj.uri + "/" + dataObj.entities[0].uuid,
              filetype: "",
              filename: tempFilePath,
              accessToken: token,
              length: Math.ceil(dur / 1000)
            },
            from: wx.getStorageSync("userEasemoInfo").easeMoUserId,
            to: _this.properties.inquiryInfo.physicianEasemobId || wx.getStorageSync('physicianEasemobId'),
            ext: {
              inquiryId: _this.properties.inquiryInfo.inquiryId,
              sourceType: 1
            },
            roomType: false,
            chatType: _this.data.chatType,
            success: function (argument) {}
          });
          msg.body.length = Math.ceil(dur / 1000);
          // 发送消息
          WebIM.conn.send(msg.body);
          // 回调事件
          _this.triggerEvent( "newRecordMsg",{ msg: msg, type: 'audio'}, { bubbles: true, composed: true }
          );
        }
      });
    },
    /**
     * 开始录音授权函数
     */
    getRecordAuthSetting (e) {
      let _this = this;
      wx.getSetting({
        success: (res) => {
          let recordAuth = res.authSetting['scope.record']
          console.log('recordAuth:', recordAuth)
          if (recordAuth == false) {
            // 打开微信授权设置开关
            wx.showModal({
              title: '提示',
              content: '此服务需要您的录音功能',
              showCancel: false,
              confirmText: '去开启',
              success: function (res) {
                if (res.confirm) {
                  // 确定按钮
                  // 新版禁用，需要通过按钮触发
                  wx.openSetting({
                    success: function (res) {
                      let recordAuth = res.authSetting['scope.record']
                      if (recordAuth == true) {
                        wx.showToast({
                          title: "授权成功",
                          icon: "success"
                        })
                      } else {
                        wx.showToast({
                          title: "请授权录音",
                          icon: "none"
                        })
                      }
                      _this.setData({
                        isLongPress: false
                      })
                    }
                  })
                }
              }
            })
          } else if (recordAuth == true) { 
            // 授权成功调用开始录音函数
            _this.getStartRecordEvent(e)
          } else {
            wx.showToast({
              title: "语音权限未授权",
              icon: "none"
            })
            // 第一次进来，未发起授权
            wx.authorize({
              scope: 'scope.record',
              success: () => {
                wx.showToast({
                  title: "授权成功",
                  icon: "success"
                })
              }
            })
          }
        },
        fail: function () {
          wx.showToast({
            title: "鉴权失败，请重试",
            icon: "none"
          })
        }
      })
    },
    /**
     * 开始授权函数
     * @params {e} 来至于 getRecordAuthSetting
     */
    getStartRecordEvent (e) {
      console.log('getStartRecordEvent')
      let _this = this;
      let recorderManager = _this.data.recorderManager
      _this.data.changedTouches = e.touches[0];
      _this.setData({
        recordStatus: _this.data.recordStatusConfig.HOLD,
      });
      // 录音动画生成
      _this.data.runAnimation = true;
      _this.getRadom();
      
      // 调用微信开始录音 api
      recorderManager.onStart(() => {});
      // 录音格式
      recorderManager.start({ format: "mp3" });
      // 超时取消录音
      setTimeout(function () {
        _this.handleRecordingCancel();
        _this.data.runAnimation = false
      }, 100000);
    },
    /**
     * 生成录音动画随机数
     */
    getRadom() {
      let _this = this;
      let radomHeight = _this.data.radomHeight;
      for (let i = 0; i < radomHeight.length; i++) {
        radomHeight[i] = (100 * Math.random().toFixed(2)) + 10;
      }
      _this.setData({
        radomHeight: radomHeight
      });
      if (_this.data.runAnimation) {
        setTimeout(function () { _this.getRadom() }, 500);
      } else {
        return false;
      }
    }
  }
});
