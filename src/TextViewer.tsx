import { Component } from 'react';
import React from 'react';
import './TextViewer.css'

const NAME = "Shrestha Prasun";
const EMAIL = "shresthaprasun1@gmail.com";
const CELL = "+81 070 7540 9128";

export class TextViewer extends Component {
  constructor(props: any) {
    super(props);
  }

  componentDidMount() {
  }

  render() {
    const text = `${NAME}\n${EMAIL}\n${CELL}`;
    return (
      <div className="TextViewer">
        {text}
      </div>
    );
  }
}


