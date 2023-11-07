const ReportModal = ({
  isOpenReportModal,
  toggleReportModal,
  sendReport,
  onReportCategoriesInputChange,
  reportDescriptionInputValue,
  onReportDescriptionInputChange,
  onReportTargetChange,
}) => {
  if (isOpenReportModal) {
    return (
      <div className='overlay'>
        <div className='overlay-content'>
          <h3>Report Modal</h3>
          <form id="report" onSubmit={(event)=>{                      
            event.preventDefault();
            const reportTarget =  event.target.reportTarget.value;            
            sendReport({target: reportTarget})
          }}>
          <div style={{
            display: 'flex',
            marginBottom: '16px',
          }}>
          
          <span>Report target: </span>
          <div style={{
            display: 'flex',
          }}>
          <input type="radio" id="user" value="User" name="reportTarget" />
          <label htmlFor="user">User</label>
          
          <input type="radio" id="message" value="Message" name="reportTarget" />
          <label htmlFor="message">Message</label>
          
          <input type="radio" id="channel" value="Channel" name="reportTarget" />
          <label htmlFor="channel">Channel</label>
          </div>
          </div>
          </form>

          <label htmlFor='report_categories'>Report categories: </label>
          <select
            className='form-input'
            name='report_categories'
            id='report_categories'
            onChange={onReportCategoriesInputChange}
          >
            <option value=''></option>
            <option value='suspicious'>Suspicious</option>
            <option value='harassing'>Harassing</option>
            <option value='inappropriate'>Inappropriate</option>
            <option value='spam'>Spam</option>
          </select>
          <label htmlFor='report_description'>Report Description: </label>
          <textarea
            onChange={onReportDescriptionInputChange}
            className='form-input'
            name='report_description'
            id='report_description'
            value={reportDescriptionInputValue}
          />
          <div>
            
            <button type="submit" form="report" className='form-button'>
              Send
            </button>
            <button
              className='form-button'
              onClick={() => toggleReportModal({}, '')}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default ReportModal;