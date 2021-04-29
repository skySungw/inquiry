// pages/inquiry/trtc/trtcRoom.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    trtcConfig:{
      sdkAppID: '', // 开通实时音视频服务创建应用后分配的 SDKAppID
      userID: '', // 用户 ID，可以由您的帐号系统指定
      userSig: '', // 身份签名，相当于登录密码的作用
      template: '1v1', // 画面排版模式
      roomID: '',  //房间号
      debugMode: false
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    //获取上页面本地存储的参数
    this.getStorageTrtcConfig()
  },
  /**
   * @description: 获取本地存储trtc 配置信息
   * @return: void
   */
  getStorageTrtcConfig: function () {
    try {
      const { appId, userSign, employeeId, roomNumber } =  wx.getStorageSync('inqueryInfo') || {};

      // 调用设置存储函数
      this.setTrtcConfig({
        appId,
        userSign,
        employeeId,
        roomNumber
      })
    } catch (e) {
      console.log('获取本地trtc配置失败')
    }
  },
  /**
   * @description: 设置trtc配置全局变量
   * @params {Object} res   
   * @return: void
   */
  setTrtcConfig: function (res) {
    this.setData({
      ["trtcConfig.sdkAppID"]: res.appId,
      ["trtcConfig.userID"]: res.employeeId,
      ["trtcConfig.userSig"]: res.userSign,
      ["trtcConfig.roomID"]: res.roomNumber
    }, () => {
      console.log(this.data.trtcConfig)
      this.handleTrtcContextEvent()
    })
  },
  /**
   * @description: 发布本地流，订阅事件。进入房间
   * @return: void
   */
  handleTrtcContextEvent: function () {
    let trtcRoomContext = this.selectComponent('#trtcroom')
    console.log('trtcRoomContext',trtcRoomContext)
    let EVENT = trtcRoomContext.EVENT

    if(trtcRoomContext) {
        trtcRoomContext.on(EVENT.LOCAL_JOIN, (event)=>{
            // 进房成功后发布本地音频流和视频流 
            trtcRoomContext.publishLocalVideo()
            trtcRoomContext.publishLocalAudio()
        })
        // 监听远端用户的视频流的变更事件
        trtcRoomContext.on(EVENT.REMOTE_VIDEO_ADD, (event)=>{
            // 订阅（即播放）远端用户的视频流
            let userID = event.data.userID
            let streamType = event.data.streamType// 'main' or 'aux'            
            trtcRoomContext.subscribeRemoteVideo({userID: userID, streamType: streamType})
        })

        // 监听远端用户的音频流的变更事件
        trtcRoomContext.on(EVENT.REMOTE_AUDIO_ADD, (event)=>{
            // 订阅（即播放）远端用户的音频流
            let userID = event.data.userID
            trtcRoomContext.subscribeRemoteAudio({userID: userID})
        })
      
        // 进入房间
        trtcRoomContext.enterRoom({roomID: this.data.trtcConfig.roomID}).catch((res)=>{
            console.error('room joinRoom 进房失败:', res)
        })
    }
  }
})