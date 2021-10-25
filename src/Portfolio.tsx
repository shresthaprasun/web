import { Component } from 'react';
import React from 'react';
import './Portfolio.css'
import { TextViewer } from './TextViewer';

export class Portfolio extends Component {
  state: { showViewer: boolean }
  isClicked: boolean;
  ref: any;
  constructor(props: any) {
    super(props);
    this.state = {
      showViewer: false
    }
    this.isClicked = false;
    this.ref = React.createRef();
  }

  handleClickOutside(event) {
    if (this.ref.current && !this.ref.current.contains(event.target)) {
      // this.props.onClickOutside && this.props.onClickOutside();
      this.setState({ showViewer: false })
      this.isClicked = false;
    }
  };

  componentDidMount() {
    document.addEventListener('pointerdown', this.handleClickOutside.bind(this), true);
  }

  componentWillUnmount() {
    document.removeEventListener('pointerdown', this.handleClickOutside.bind(this), true);
  };

  onMouseEnter() {
    if (!this.isClicked) {
      this.setState({ showViewer: true })
    }
  }

  onMouseOut() {
    if (!this.isClicked) {
      this.setState({ showViewer: false })
    }
  }

  onPointerDown() {
    this.isClicked = true;
    this.setState({ showViewer: true })
  }

  render() {
    return (
      <div className="Portfolio" ref={this.ref}>
        <img src="avatar.png" alt="Avatar"
          onPointerDown={this.onPointerDown.bind(this)}
          onMouseEnter={this.onMouseEnter.bind(this)}
          onMouseOut={this.onMouseOut.bind(this)}
        ></img>
        {this.state.showViewer ? <TextViewer /> : null}
      </div>
    );
  }
}


