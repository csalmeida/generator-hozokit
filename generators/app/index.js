'use strict';
// Required for generator to work
const Generator = require('yeoman-generator');
const chalk = require('chalk');
const yosay = require('yosay');

// Used to download and unzip files
const https = require('https');
const fs = require('fs');
const AdmZip = require('adm-zip');
const fse = require('fs-extra');

// Used to convey loading states in the terminal (loading, downloading...)
const Multispinner = require('multispinner');
  
module.exports = class extends Generator {
  prompting() {
    // Have Yeoman greet the user.
    this.log(
      yosay(`Welcome to the praiseworthy ${chalk.red('generator-hozokit')} generator!`)
    );

    const prompts = [
      {
        type: "input",
        name: "projectName",
        message: "What is your project name?",
        default: "hozokit" // Default to current folder name
      },
      {
        type: 'confirm',
        name: 'installWordpress',
        message: 'Would you like Wordpress to be installed?',
        default: true
      }
    ];

    return this.prompt(prompts).then(props => {
      // To access props later use this.props.someAnswer;
      this.props = props;
      this.props.projectFolderName = this._dashify(this.props.projectName);
    });
  }

  writing() {
    // Installs Wordpress
    if (this.props.installWordpress) {
      this._installWordpress(
        this._dashify(this.props.projectFolderName)
      );
    }

    // this.fs.copyTpl(
    //   this.templatePath('dummyfile.txt'),
    //   this.destinationPath('dummyfile.txt'),
    //   { projectName: this.props.projectName }
    // );
  }

  /**
   * Downloads and installs the latest version of Wordpress in the project root directory.
   * This functionality should be optional and a Hozokit project should still be able to be generated whether or not this function runs.
   * @param {String} projectName Name of the project, used to name root folder. e.g 'hozokit' or this.props.projectName
  */
  _installWordpress(projectName) {
    this.log('Installing the latest version of Wordpress.');

    // Creates a temporary directory if one is not already in place.
    this._createProjectDirectory(projectName);

    const spinners = ['Downloading Wordpress'];
    const m = new Multispinner(spinners)
    // Downloads a zipped copy of Wordpress into the folder.
    const zipPath = `./${projectName}/wordpress.zip`;
    const file = fs.createWriteStream(zipPath);
    const downloadURL = "https://wordpress.org/latest.zip"
    
    // This message is shown later to the user if any issues with the download come up.
    let downloadError = null;
    const request = https.get(downloadURL, function(response) {
      response.pipe(file);

      // Use to add logic for when a request is in progress.
      // response.on('data', (data) => {
      //   console.log('Downloading', data);
      // });

      response.on('end', (data) => {        
        if (response.statusCode == 200) {
          m.success(spinners[0]);

        } else {
          downloadError = `Download has failed. (${response.statusCode})`;
          m.error(spinners[0]);
        }
      });
    
    }).on('error', (error) => {
      downloadError = error;
      m.error(spinners[0]);
    });

    // Displays a message once download is complete.
    m.on('success', () => {
      // this.log(`${chalk.green('Success:')} Download of Wordpress has completed.`);
      this._extractWordpress(projectName)
    }).on('err', (error) => {
      if (downloadError) {
        this.log(`${chalk.red('Error:')} ${downloadError}`);
      } else {
        this.log(`${chalk.red('Error:')} ${error} Download has been cancelled with an unknown error.`)
      }
    })
  }

  /**
   * Extracts Wordpress.zip into /wordpress
   * Copies contents of /wordpress into project folder.
   * Removes /wordpress and wordpress.zip when done.
   * @param {String} projectName Name of the project, used to name root folder. e.g 'hozokit' or this.props.projectName
   * @param {String} multispinner An instance of a multispinner used to track the progress of the extraction.
  */
  _extractWordpress(projectName) {
    const spinners = ['Extracting Wordpress'];
    const m = new Multispinner(spinners)

    // Extracts contents of Wordpress.
    const zipPath = `./${projectName}/wordpress.zip`;
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(`${projectName}/`, true);

    let extractError = null;

    fse.copy(`./${projectName}/wordpress`, `./${projectName}`, { overwrite: true }, err => {
      
      if (err)  {
        extractError = `
        Could not copy files to ./${projectName}. \n
        ./${err}
        `
      } else {
        // Cleans up by removing extracted folder and zip.
        try {
          fs.rmdirSync(`./${projectName}/wordpress`, { recursive: true });
        } catch (err) {
            // console.error(`Error while deleting ${`/${projectName}/wordpress`}.`);
            extractError = `
            Could not remove ./${projectName}/wordpress. \n
            ./${err}
            `
            m.error(spinners[0]);
        }
      
        try {
          fs.unlinkSync(zipPath);
          // console.log("File is deleted.");
        } catch (error) {
          extractError = `
          Could not remove ./${zipPath}. \n
          ./${err}
          `
          m.error(spinners[0]);
        }
      }

      // If no error has been set, mark as successful.
      if (extractError == null) {
        m.success(spinners[0]);
      }

      // Displays error messages once extract is complete.
      m.on('err', (error) => {
        if (extractError) {
          this.log(`${chalk.red('Error:')} ${extractError}`);
        } else {
          this.log(`${chalk.red('Error:')} ${error} Extract has been stopped with an unknown error.`)
        }
      })
    });
  }

  /**
   * It creates the project directory if one is not already in place.
   * It is useful when running generators separately that 
   * require the project root folder to be in place before a task is performed.
   * @param {String} projectName Name of the project, used to name root folder. e.g 'hozokit' or this.props.projectName
  */
  _createProjectDirectory(projectName) {
    const directory = `./${projectName}`;
    try {
      if (!fs.existsSync(directory)) {
          fs.mkdirSync(directory);
          // this.log("Created temporary directory.");
      } else {
        // this.log("Temporary directory already exists, moving on.");
      }
    } catch (err) {
        this.log(err);
    }
  }

  /**
   * It transforms a string separated by spaces into a dash separated one.
   * For example Hozokit Generator Project will be converted to hozokit-generator-project.
   * This is useful to create project directories for users without prompting them for the project folder name.
   * @param {String} value The value to be dashified. e.g 'Hozokit Generator Project'
   * @param {String} target (optional) The string that will be replaced with the separator. The default is a space ' '.
   * @param {String} separator (optional) The string the target value should be replaced with. The default is a dash '-'.
  */
  _dashify(value, target = ' ', separator = '-') {
    const lowerCaseValue = value.toLowerCase();
    return lowerCaseValue.split(target).join(separator);
  }

  // install() {
  //   this.installDependencies();
  // }
};
