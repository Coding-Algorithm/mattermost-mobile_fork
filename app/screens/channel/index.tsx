// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withDatabase} from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import {combineLatest, distinctUntilChanged, of as of$, switchMap} from 'rxjs';

import {observeIsCallsEnabledInChannel} from '@calls/observers';
import {
    observeCallsState,
    observeChannelsWithCalls,
    observeCurrentCall,
    observeIncomingCalls,
} from '@calls/state';
import {withServerUrl} from '@context/server';
import {observeCurrentChannelId} from '@queries/servers/system';

import Channel from './channel';

import type {WithDatabaseArgs} from '@typings/database/database';

type EnhanceProps = WithDatabaseArgs & {
    serverUrl: string;
}

const enhanced = withObservables([], ({database, serverUrl}: EnhanceProps) => {
    const channelId = observeCurrentChannelId(database);

    const isCallInCurrentChannel = combineLatest([channelId, observeChannelsWithCalls(serverUrl)]).pipe(
        switchMap(([id, calls]) => of$(Boolean(calls[id]))),
        distinctUntilChanged(),
    );
    const currentCall = observeCurrentCall();
    const ccChannelId = currentCall.pipe(
        switchMap((call) => of$(call?.channelId)),
        distinctUntilChanged(),
    );
    const isInACall = currentCall.pipe(
        switchMap((call) => of$(Boolean(call?.connected))),
        distinctUntilChanged(),
    );
    const dismissed = combineLatest([channelId, observeCallsState(serverUrl)]).pipe(
        switchMap(([id, state]) => of$(Boolean(state.calls[id]?.dismissed[state.myUserId]))),
        distinctUntilChanged(),
    );
    const isInCurrentChannelCall = combineLatest([channelId, ccChannelId]).pipe(
        switchMap(([id, ccId]) => of$(id === ccId)),
        distinctUntilChanged(),
    );
    const showJoinCallBanner = combineLatest([isCallInCurrentChannel, dismissed, isInCurrentChannelCall]).pipe(
        switchMap(([isCall, dism, inCurrCall]) => of$(Boolean(isCall && !dism && !inCurrCall))),
        distinctUntilChanged(),
    );
    const showIncomingCalls = observeIncomingCalls().pipe(
        switchMap((ics) => of$(ics.incomingCalls.length > 0)),
        distinctUntilChanged(),
    );

    return {
        channelId,
        showJoinCallBanner,
        isInACall,
        showIncomingCalls,
        isCallsEnabledInChannel: observeIsCallsEnabledInChannel(database, serverUrl, channelId),
    };
});

export default withDatabase(withServerUrl(enhanced(Channel)));
