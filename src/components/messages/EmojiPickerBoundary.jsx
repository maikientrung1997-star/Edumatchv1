import { Component } from 'react';

/** Keep a failed emoji chunk or picker render local to the popover, preserving the conversation and draft. */
export class EmojiPickerBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <div className="em-emoji-error" role="alert"><strong>Chưa tải được bảng biểu tượng</strong><p>Bạn vẫn có thể nhập và gửi tin nhắn. Hãy tải lại trang khi kết nối ổn định.</p><button type="button" onClick={this.props.onClose}>Đóng bảng biểu tượng</button></div>;
    }
    return this.props.children;
  }
}
