import { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import { Project } from './Project';
import React from 'react';

export class App extends Component {
  private project: Project;
  private ref: any;

  constructor(props: any) {
    super(props);
    this.ref = React.createRef();
    this.project = new Project();
  }

  componentDidMount() {
    this.project.init(this.ref.current);
    this.project.animate();
    window["project"] = this.project;
  }

  render() {
    return (
      <div className="App" ref={this.ref}></div>
    );
  }
}


export default App;
