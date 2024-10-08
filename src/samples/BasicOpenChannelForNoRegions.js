import { useState, useEffect, useRef, useContext } from 'react';
import { ConnectionHandler } from '@sendbird/chat';

import { v4 as uuid } from 'uuid';
import { PollVoteEvent } from '@sendbird/chat/poll';

import SendbirdChat from '@sendbird/chat';
import {
  OpenChannelModule,
  OpenChannelHandler,
} from '@sendbird/chat/openChannel';

import { timestampToTime, handleEnterPress } from '../utils/messageUtils';
import { GlobalContext } from '../GlobalProvider';

let sb;

const BasicOpenChannelNoRegions = (props) => {
  const { appId } = useContext(GlobalContext);
  const [state, updateState] = useState({
    currentlyJoinedChannel: null,
    currentlyUpdatingChannel: null,
    messages: [],
    channels: [],
    showChannelCreate: false,
    messageInputValue: '',
    userNameInputValue: '',
    userIdInputValue: '',
    channelNameInputValue: '',
    settingUpUser: true,
    file: null,
    messageToUpdate: null,
    loading: false,
    error: false,
    pollMessageToUpdate: null,
    isCreatePollModalOpen: false,
    pollTitleValue: '',
    pollOptionValue: '',
    pollOptionsArray: [],
    isPollAnonymous: false,
    updatedPollOptionText: '',
    isAddNewOptionModal: false,
    newPollOptionText: '',
    currentPoll: null,
  });

  //need to access state in message received callback
  const stateRef = useRef();
  stateRef.current = state;

  const channelRef = useRef();

  const scrollToBottom = (item, smooth) => {
    item?.scrollTo({
      top: item.scrollHeight,
      behavior: smooth,
    });
  };

  useEffect(() => {
    scrollToBottom(channelRef.current);
  }, [state.currentlyJoinedChannel]);

  useEffect(() => {
    scrollToBottom(channelRef.current, 'smooth');
  }, [state.messages]);

  const onError = (error) => {
    updateState({ ...state, error: error.message });
    console.log(error);
  };

  const addOrRemoveVoice = async (e, option, message, poll) => {
    const { userIdInputValue, checkedOptions, currentlyJoinedChannel } = state;

    let pollOptionId = option.id;
    let pollOptionIds = [pollOptionId];
    let pollId = poll.id;
    let newVoteCount = e.currentTarget.checked
      ? option.voteCount + 1
      : option.voteCount - 1;
    const updatedVoteCounts = {
      voteCount: newVoteCount,
      optionId: pollOptionId,
    };
    let ts = Date.now();
    let messageId = message.id;
    const pollVoteEventPayload = {
      updatedVoteCounts,
      ts,
      pollId,
      messageId,
    };

    let pollEvent = new PollVoteEvent(pollId, messageId, pollVoteEventPayload);

    switch (e.currentTarget.type) {
      case 'checkbox':
        if (e.currentTarget.checked) {
          const newCheckedOptions = checkedOptions.slice(0);
          newCheckedOptions.push(option.id);

          updateState({ ...state, checkedOptions: newCheckedOptions });

          if (!poll.votedPollOptionIds.includes(pollOptionId)) {
            await currentlyJoinedChannel.votePoll(
              pollId,
              newCheckedOptions,
              pollEvent
            );
          }
        } else if (!e.currentTarget.checked) {
          const newCheckedOptions = checkedOptions.slice(0);
          const filteredNewCheckedOptions = newCheckedOptions.filter(
            (item) => item !== option.id
          );

          updateState({
            ...state,
            checkedOptions: filteredNewCheckedOptions,
          });

          if (poll.votedPollOptionIds.includes(pollOptionId)) {
            await currentlyJoinedChannel.votePoll(
              pollId,
              filteredNewCheckedOptions,
              pollEvent
            );
          }
        }
        break;
      case 'radio':
        if (e.currentTarget.checked) {
          if (!poll.votedPollOptionIds.includes(pollOptionId)) {
            await currentlyJoinedChannel.votePoll(
              pollId,
              pollOptionIds,
              pollEvent
            );
          }
        }
        break;
      default:
        console.log('error');
    }
  };

  const handleJoinChannel = async (channelUrl) => {
    if (state.currentlyJoinedChannel?.url === channelUrl) {
      return null;
    }
    const { channels } = state;
    updateState({ ...state, loading: true });
    const channelToJoin = channels.find(
      (channel) => channel.url === channelUrl
    );
    await channelToJoin.enter();
    const [messages, error] = await loadMessages(channelToJoin);

    if (error) {
      return onError(error);
    }

    // setup connection event handlers
    const connectionHandler = new ConnectionHandler();

    connectionHandler.onReconnectSucceeded = async () => {
      const [messages, error] = await loadMessages(channelToJoin);

      updateState({ ...stateRef.current, messages: messages });
    };

    sb.addConnectionHandler(uuid(), connectionHandler);

    //listen for incoming messages
    const channelHandler = new OpenChannelHandler();
    channelHandler.onMessageUpdated = (channel, message) => {
      const messageIndex = stateRef.current.messages.findIndex(
        (item) => item.messageId == message.messageId
      );
      const updatedMessages = [...stateRef.current.messages];
      updatedMessages[messageIndex] = message;
      updateState({ ...stateRef.current, messages: updatedMessages });
    };

    channelHandler.onMessageReceived = (channel, message) => {
      const updatedMessages = [...stateRef.current.messages, message];
      updateState({ ...stateRef.current, messages: updatedMessages });
    };

    channelHandler.onMessageDeleted = (channel, message) => {
      const updatedMessages = stateRef.current.messages.filter(
        (messageObject) => {
          return messageObject.messageId !== message;
        }
      );
      updateState({ ...stateRef.current, messages: updatedMessages });
    };
    sb.openChannel.addOpenChannelHandler(uuid(), channelHandler);
    updateState({
      ...state,
      currentlyJoinedChannel: channelToJoin,
      messages: messages,
      loading: false,
    });
  };

  const handleLeaveChannel = async () => {
    const { currentlyJoinedChannel } = state;
    await currentlyJoinedChannel.exit();

    updateState({ ...state, currentlyJoinedChannel: null });
  };

  const handleCreateChannel = async () => {
    const { channelNameInputValue } = state;
    const [openChannel, error] = await createChannel(channelNameInputValue);
    if (error) {
      return onError(error);
    }
    const updatedChannels = [openChannel, ...state.channels];
    updateState({
      ...state,
      channels: updatedChannels,
      showChannelCreate: false,
    });
  };

  const handleDeleteChannel = async (channelUrl) => {
    const [channel, error] = await deleteChannel(channelUrl);
    if (error) {
      return onError(error);
    }
    const updatedChannels = state.channels.filter((channel) => {
      return channel.url !== channelUrl;
    });
    updateState({ ...state, channels: updatedChannels });
  };

  const handleUpdateChannel = async () => {
    const { currentlyUpdatingChannel, channelNameInputValue, channels } = state;
    const [updatedChannel, error] = await updateChannel(
      currentlyUpdatingChannel,
      channelNameInputValue
    );
    if (error) {
      return onError(error);
    }
    const indexToReplace = channels.findIndex(
      (channel) => channel.url === currentlyUpdatingChannel.channelUrl
    );
    const updatedChannels = [...channels];
    updatedChannels[indexToReplace] = updatedChannel;
    updateState({
      ...state,
      channels: updatedChannels,
      currentlyUpdatingChannel: null,
    });
  };

  const toggleChannelDetails = (channel) => {
    if (channel) {
      updateState({ ...state, currentlyUpdatingChannel: channel });
    } else {
      updateState({ ...state, currentlyUpdatingChannel: null });
    }
  };

  const toggleShowCreateChannel = () => {
    updateState({ ...state, showChannelCreate: !state.showChannelCreate });
  };

  const onChannelNamenIputChange = (e) => {
    const channelNameInputValue = e.currentTarget.value;
    updateState({ ...state, channelNameInputValue });
  };

  const onUserNameInputChange = (e) => {
    const userNameInputValue = e.currentTarget.value;
    updateState({ ...state, userNameInputValue });
  };

  const onUserIdInputChange = (e) => {
    const userIdInputValue = e.currentTarget.value;
    updateState({ ...state, userIdInputValue });
  };

  const onMessageInputChange = (e) => {
    const messageInputValue = e.currentTarget.value;
    updateState({ ...state, messageInputValue });
  };

  const sendMessage = async () => {
    const { messageToUpdate, currentlyJoinedChannel, messages } = state;

    if (messageToUpdate) {
      const userMessageUpdateParams = {};
      userMessageUpdateParams.message = state.messageInputValue;
      const updatedMessage = await currentlyJoinedChannel.updateUserMessage(
        messageToUpdate.messageId,
        userMessageUpdateParams
      );
      const messageIndex = messages.findIndex(
        (item) => item.messageId == messageToUpdate.messageId
      );
      messages[messageIndex] = updatedMessage;
      updateState({
        ...state,
        messages: messages,
        messageInputValue: '',
        messageToUpdate: null,
      });
    } else {
      const userMessageParams = {};
      userMessageParams.message = state.messageInputValue;
      currentlyJoinedChannel
        .sendUserMessage(userMessageParams)
        .onSucceeded((message) => {
          const updatedMessages = [...messages, message];
          updateState({
            ...state,
            messages: updatedMessages,
            messageInputValue: '',
          });
        })
        .onFailed((error) => {
          console.log(error);
          console.log('failed');
        });
    }
  };

  const onFileInputChange = async (e) => {
    if (e.currentTarget.files && e.currentTarget.files.length > 0) {
      const { currentlyJoinedChannel, messages } = state;
      const fileMessageParams = {};
      fileMessageParams.file = e.currentTarget.files[0];
      currentlyJoinedChannel
        .sendFileMessage(fileMessageParams)
        .onSucceeded((message) => {
          const updatedMessages = [...messages, message];
          updateState({
            ...state,
            messages: updatedMessages,
            messageInputValue: '',
            file: null,
          });
        })
        .onFailed((error) => {
          console.log(error);
          console.log('failed');
        });
    }
  };

  const handleDeleteMessage = async (messageToDelete) => {
    const { currentlyJoinedChannel } = state;
    await deleteMessage(currentlyJoinedChannel, messageToDelete); // Delete
  };

  const updateMessage = async (message) => {
    updateState({
      ...state,
      messageToUpdate: message,
      messageInputValue: message.message,
    });
  };

  const setupUser = async () => {
    const { userNameInputValue, userIdInputValue } = state;
    const sendbirdChat = await SendbirdChat.init({
      appId: appId,
      localCacheEnabled: true,      
      customApiHost: `https://api-${appId}.sendbirdtest.com`,
      customWebSocketHost: `wss://ws-${appId}.sendbirdtest.com`,
      modules: [new OpenChannelModule()],
    });

    try {
      await sendbirdChat.connect(userIdInputValue, '0e420e00b759db3d54748c3ee5ff2d18b2858dbd');
    } catch (e) {
      console.log('error', e);
    }

    await sendbirdChat.setChannelInvitationPreference(true);

    const userUpdateParams = {};
    userUpdateParams.nickname = userNameInputValue;
    userUpdateParams.userId = userIdInputValue;
    await sendbirdChat
      .updateCurrentUserInfo(userUpdateParams)
      .then((data) => console.log(data));

    sb = sendbirdChat;

    updateState({ ...state, loading: true });
    const [channels, error] = await loadChannels();
    if (error) {
      return onError(error);
    }
    updateState({
      ...state,
      channels: channels,
      loading: false,
      settingUpUser: false,
    });
  };

  if (state.loading) {
    return <div>Loading...</div>;
  }

  if (state.error) {
    return (
      <div className='error'>
        {state.error} check console for more information.
      </div>
    );
  }

  console.log('- - - - State object very useful for debugging - - - -');
  console.log(state);

  return (
    <>
      <CreateUserForm
        setupUser={setupUser}
        userNameInputValue={state.userNameInputValue}
        userIdInputValue={state.userIdInputValue}
        settingUpUser={state.settingUpUser}
        onUserIdInputChange={onUserIdInputChange}
        onUserNameInputChange={onUserNameInputChange}
      />
      <ChannelList
        channels={state.channels}
        toggleChannelDetails={toggleChannelDetails}
        handleJoinChannel={handleJoinChannel}
        toggleShowCreateChannel={toggleShowCreateChannel}
        handleDeleteChannel={handleDeleteChannel}
      />
      <ChannelDetails
        currentlyUpdatingChannel={state.currentlyUpdatingChannel}
        handleUpdateChannel={handleUpdateChannel}
        onChannelNamenIputChange={onChannelNamenIputChange}
        toggleChannelDetails={toggleChannelDetails}
      />
      <ChannelCreate
        showChannelCreate={state.showChannelCreate}
        toggleShowCreateChannel={toggleShowCreateChannel}
        onChannelNamenIputChange={onChannelNamenIputChange}
        handleCreateChannel={handleCreateChannel}
      />
      <Channel
        currentlyJoinedChannel={state.currentlyJoinedChannel}
        handleLeaveChannel={handleLeaveChannel}
        channelRef={channelRef}
      >
        <MessagesList
          messages={state.messages}
          handleDeleteMessage={handleDeleteMessage}
          updateMessage={updateMessage}
          handleDeleteOption={() => {}}
          isShowPollModals={() => {}}
          closePoll={() => {}}
          addOrRemoveVoice={addOrRemoveVoice}
        />
        <MessageInput
          value={state.messageInputValue}
          onChange={onMessageInputChange}
          sendMessage={sendMessage}
          fileSelected={state.file}
          onFileInputChange={onFileInputChange}
        />
      </Channel>
    </>
  );
};

// Chat UI Components
const ChannelList = ({
  channels,
  handleJoinChannel,
  toggleShowCreateChannel,
  handleDeleteChannel,
  toggleChannelDetails,
}) => {
  return (
    <div className='channel-list'>
      <div className='channel-type'>
        <h1>Open Channels</h1>
        <button
          className='channel-create-button'
          onClick={toggleShowCreateChannel}
        >
          Create Channel
        </button>
      </div>
      {channels.map((channel) => {
        const userIsOperator = channel.operators.some(
          (operator) => operator.userId === sb.currentUser.userId
        );
        return (
          <div key={channel.url} className='channel-list-item'>
            <div
              className='channel-list-item-name'
              onClick={() => {
                handleJoinChannel(channel.url);
              }}
            >
              {channel.name}
            </div>
            {userIsOperator && (
              <div>
                <button
                  className='control-button'
                  onClick={() => toggleChannelDetails(channel)}
                >
                  <img className='channel-icon' src='/icon_edit.png' />
                </button>
                <button
                  className='control-button'
                  onClick={() => handleDeleteChannel(channel.url)}
                >
                  <img className='channel-icon' src='/icon_delete.png' />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const Channel = ({
  currentlyJoinedChannel,
  handleLeaveChannel,
  children,
  channelRef,
}) => {
  if (currentlyJoinedChannel) {
    return (
      <div className='channel' ref={channelRef}>
        <ChannelHeader>{currentlyJoinedChannel.name}</ChannelHeader>
        <div>
          <button className='leave-channel' onClick={handleLeaveChannel}>
            Exit Channel
          </button>
        </div>
        <div>{children}</div>
      </div>
    );
  }
  return <div className='channel'></div>;
};

const ChannelHeader = ({ children }) => {
  return <div className='channel-header'>{children}</div>;
};

const MessagesList = ({
  messages,
  handleDeleteMessage,
  updateMessage,
  handleDeleteOption,
  closePoll,
  isShowPollModals,
  addOrRemoveVoice,
}) => {
  return (
    <div className='message-list'>
      {messages.map((message) => {
        if (!message.sender) return null;
        const messageSentByYou =
          message.sender.userId === sb.currentUser.userId;
        return (
          <div
            key={message.messageId}
            className={`message-item ${
              messageSentByYou ? 'message-from-you' : ''
            }`}
          >
            <Message
              message={message}
              handleDeleteMessage={handleDeleteMessage}
              updateMessage={updateMessage}
              handleDeleteOption={handleDeleteOption}
              isShowPollModals={isShowPollModals}
              closePoll={closePoll}
              addOrRemoveVoice={addOrRemoveVoice}
              messageSentByYou={messageSentByYou}
            />
          </div>
        );
      })}
    </div>
  );
};

const Message = ({
  message,
  updateMessage,
  handleDeleteMessage,
  messageSentByYou,
  handleDeleteOption,
  closePoll,
  isShowPollModals,
  addOrRemoveVoice,
}) => {
  const messageSentByCurrentUser =
    message.sender.userId === sb.currentUser.userId;

  console.log('message._poll: ', message._poll);
  if (message._poll) {
    const { title, options, allowMultipleVotes, allowUserSuggestion, status } =
      message._poll;

    return (
      <div
        className={`message poll-message ${
          messageSentByYou ? 'message-from-you' : ''
        }`}
      >
        <div className='message-info'>
          <div className='message-user-info'>
            <div className='message-sender-name'>
              {message.sender.nickname}{' '}
            </div>
            <div>{timestampToTime(message.createdAt)}</div>
          </div>
          {messageSentByCurrentUser && (
            <div>
              <button
                className='control-button'
                onClick={() => updateMessage(message)}
              >
                <img className='message-icon' src='/icon_edit.png' />
              </button>
              <button
                className='control-button'
                onClick={() => handleDeleteMessage(message)}
              >
                <img className='message-icon' src='/icon_delete.png' />
              </button>
            </div>
          )}
        </div>
        <div>Poll {title}:</div>
        <div>
          {options.map((option, i) => {
            return (
              <div
                key={option.id}
                className='freeze-channel input_wrapper option_wrapper'
              >
                <span style={{ marginRight: '5px' }}>{option.voteCount}:</span>
                {status === 'open' && (
                  <input
                    type={allowMultipleVotes ? 'checkbox' : 'radio'}
                    onClick={(e) =>
                      addOrRemoveVoice(e, option, message, message._poll)
                    }
                    name='option'
                  />
                )}
                <label htmlFor='option'>{option.text}</label>
                {messageSentByCurrentUser && status === 'open' && (
                  <>
                    <button
                      className='control-button'
                      onClick={() =>
                        isShowPollModals(
                          option,
                          'open',
                          'isUpdateOptionModal',
                          'optionToUpdate'
                        )
                      }
                    >
                      <img className='option-icon' src='/icon_edit.png' />
                    </button>
                    <button
                      className='control-button'
                      onClick={() => handleDeleteOption(option)}
                    >
                      <img className='option-icon' src='/icon_delete.png' />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className='poll-status_wrapper'>
          {(messageSentByCurrentUser || allowUserSuggestion) &&
            status === 'open' && (
              <button
                onClick={() =>
                  isShowPollModals(
                    message._poll,
                    'open',
                    'isAddNewOptionModal',
                    'currentPoll'
                  )
                }
                className='add-new-option'
              >
                Add new option
              </button>
            )}
          {messageSentByCurrentUser && status === 'open' && (
            <button
              className='add-new-option'
              onClick={() => closePoll(message._poll)}
            >
              Close poll
            </button>
          )}
          <span className='poll-status'>Poll status: {status}</span>
        </div>
      </div>
    );
  }

  if (message.url) {
    return (
      <div className={`message  ${messageSentByYou ? 'message-from-you' : ''}`}>
        <div className='message-user-info'>
          <div className='message-sender-name'>{message.sender.nickname} </div>
          <div>{timestampToTime(message.createdAt)}</div>
        </div>
        <img src={message.url} />
      </div>
    );
  }

  return (
    <div className={`message  ${messageSentByYou ? 'message-from-you' : ''}`}>
      <div className='message-info'>
        <div className='message-user-info'>
          <div className='message-sender-name'>{message.sender.nickname} </div>
          <div>{timestampToTime(message.createdAt)}</div>
        </div>
        {messageSentByCurrentUser && (
          <div>
            <button
              className='control-button'
              onClick={() => updateMessage(message)}
            >
              <img className='message-icon' src='/icon_edit.png' />
            </button>
            <button
              className='control-button'
              onClick={() => handleDeleteMessage(message)}
            >
              <img className='message-icon' src='/icon_delete.png' />
            </button>
          </div>
        )}
      </div>
      <div>{message.message}</div>
    </div>
  );
};

const MessageInput = ({ value, onChange, sendMessage, onFileInputChange }) => {
  return (
    <div className='message-input'>
      <input
        placeholder='write a message'
        value={value}
        onChange={onChange}
        onKeyDown={(event) => handleEnterPress(event, sendMessage)}
      />
      <div className='message-input-buttons'>
        <button className='send-message-button' onClick={sendMessage}>
          Send Message
        </button>
        <label className='file-upload-label' htmlFor='upload'>
          Select File
        </label>
        <input
          id='upload'
          className='file-upload-button'
          type='file'
          hidden={true}
          onChange={onFileInputChange}
          onClick={() => {}}
        />
      </div>
    </div>
  );
};

const ChannelDetails = ({
  currentlyUpdatingChannel,
  toggleChannelDetails,
  handleUpdateChannel,
  onChannelNamenIputChange,
}) => {
  if (currentlyUpdatingChannel) {
    return (
      <div className='overlay'>
        <div className='overlay-content'>
          <h3>Update Channel Details</h3>
          <div> Channel name</div>
          <input className='form-input' onChange={onChannelNamenIputChange} />
          <button
            className='form-button'
            onClick={() => toggleChannelDetails(null)}
          >
            Close
          </button>
          <button onClick={() => handleUpdateChannel()}>
            Update channel name
          </button>
        </div>
      </div>
    );
  }
  return null;
};

const ChannelCreate = ({
  showChannelCreate,
  toggleShowCreateChannel,
  handleCreateChannel,
  onChannelNamenIputChange,
}) => {
  if (showChannelCreate) {
    return (
      <div className='overlay'>
        <div className='overlay-content'>
          <div>
            <h3>Create Channel</h3>
          </div>
          <div>Name</div>
          <input
            className='form-input'
            onChange={onChannelNamenIputChange}
            onKeyDown={(event) => handleEnterPress(event, handleCreateChannel)}
          />
          <div>
            <button className='form-button' onClick={handleCreateChannel}>
              Create
            </button>
            <button className='form-button' onClick={toggleShowCreateChannel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const CreateUserForm = ({
  setupUser,
  settingUpUser,
  userNameInputValue,
  userIdInputValue,
  onUserNameInputChange,
  onUserIdInputChange,
}) => {
  if (settingUpUser) {
    return (
      <div className='overlay'>
        <div
          className='overlay-content'
          onKeyDown={(event) => handleEnterPress(event, setupUser)}
        >
          <div>User ID</div>

          <input
            onChange={onUserIdInputChange}
            className='form-input'
            type='text'
            value={userIdInputValue}
          />

          <div>User Nickname</div>
          <input
            onChange={onUserNameInputChange}
            className='form-input'
            type='text'
            value={userNameInputValue}
          />

          <div>
            <button className='user-submit-button' onClick={setupUser}>
              Connect
            </button>
          </div>
        </div>
      </div>
    );
  } else {
    return null;
  }
};

// Helpful functions that call Sendbird
const loadChannels = async () => {
  try {
    const openChannelQuery = sb.openChannel.createOpenChannelListQuery({
      limit: 30,
    });
    const channels = await openChannelQuery.next();
    return [channels, null];
  } catch (error) {
    return [null, error];
  }
};

const loadMessages = async (channel) => {
  try {
    //list all messages
    const messageListParams = {};
    messageListParams.nextResultSize = 20;
    const messages = await channel.getMessagesByTimestamp(0, messageListParams);
    return [messages, null];
  } catch (error) {
    return [null, error];
  }
};

const createChannel = async (channelName) => {
  try {
    const openChannelParams = {};
    openChannelParams.name = channelName;
    openChannelParams.operatorUserIds = [sb.currentUser.userId];
    const openChannel = await sb.openChannel.createChannel(openChannelParams);
    return [openChannel, null];
  } catch (error) {
    return [null, error];
  }
};

const deleteChannel = async (channelUrl) => {
  try {
    const channel = await sb.openChannel.getChannel(channelUrl);
    await channel.delete();
    return [channel, null];
  } catch (error) {
    return [null, error];
  }
};

const updateChannel = async (
  currentlyUpdatingChannel,
  channelNameInputValue
) => {
  try {
    const channel = await sb.openChannel.getChannel(
      currentlyUpdatingChannel.url
    );
    const openChannelParams = {};
    openChannelParams.name = channelNameInputValue;
    openChannelParams.operatorUserIds = [sb.currentUser.userId];
    const updatedChannel = await channel.updateChannel(openChannelParams);
    return [updatedChannel, null];
  } catch (error) {
    return [null, error];
  }
};

const deleteMessage = async (currentlyJoinedChannel, messageToDelete) => {
  await currentlyJoinedChannel.deleteMessage(messageToDelete);
};

export default BasicOpenChannelNoRegions;
