import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RouterExtensions } from 'nativescript-angular/router';
import { Page } from 'ui/page';
import { action } from 'ui/dialogs';
import * as frameModule from 'ui/frame';

import { GroupsService, AlertService, EverliveProvider, UsersService, PlatformService } from '../../services';
import { Group, User, GroupJoinRequest } from '../../shared/models';
import { utilities, AndroidBackOverrider } from '../../shared';

@Component({
    moduleId: module.id,
    selector: 'group-details',
    templateUrl: './group-details.template.html',
    styleUrls: ['./group-details.component.css']
})
export class GroupDetailsComponent extends AndroidBackOverrider implements OnInit {
    group: Group;
    hasJoined: boolean = null;
    members: User[] = [];
    isAndroid: boolean = false;
    iosPopupOpen: boolean = false;
    membershipChanged: boolean = false;
    userApplication: GroupJoinRequest = null;
    requestCount: number;
    private _currentUser: User;
    private _disableJoinBtn: boolean = false;

    constructor(
        private _usersService: UsersService,
        private _activatedRoute: ActivatedRoute,
        private _alertsService: AlertService,
        private _everliveProvider: EverliveProvider,
        private _routerExtensions: RouterExtensions,
        private _platform: PlatformService,
        private _groupsService: GroupsService,
        private _page: Page
    ) {
        super(_page, _platform.isAndroid);
        this.isAndroid = this._platform.isAndroid;
    }

    ngOnInit() {
        this._page.actionBar.title = '';
        this._activatedRoute.params.subscribe(p => {
            let groupId = p['id'];

            this._groupsService.getUnresolvedRequestsCount(groupId)
                .then(count => this.requestCount = count);

            let userPrm = this._usersService.currentUser()
                .then(user => this._currentUser = user);

            let groupPrm = this._groupsService.getById(groupId)
                .then(group => {
                    this.group = group;
                    this._page.actionBar.title = this.group.Name;
                });

            Promise.all<any>([userPrm, groupPrm])
                .then(() => this._groupsService.getGroupMembers(this.group.Id))
                .then(members => this.members = members)
                .then(() => this._groupsService.getApplication(this.group.Id, this._currentUser.Id))
                .then((application) => {
                    this.userApplication = application;
                    this.hasJoined = this.members.some(m => m.Id === this._currentUser.Id);

                    if (!this.userApplication && !this.hasJoined && p['joinRedirect']) {
                        this.onJoin(); // this handles its errors
                    }
                })
                .catch(err => {
                    this._disableJoinBtn = false;
                    this._alertsService.showError(err && err.message);
                });;
        });
    }

    deleteGroup() {
        this._alertsService.askConfirmation(`Delete "${this.group.Name}"?`)
            .then(() => this._groupsService.delete(this.group.Id))
            .then(() => this._alertsService.showSuccess(`Group "${this.group.Name}" deleted!`))
            .then(() => {
                let transition = utilities.getReversePageTransition();
                this._routerExtensions.navigate(['/groups'], { clearHistory: true, transition });
            })
            .catch(err => err && this._alertsService.showError(err.message));
    }

    getRemainingText() {
        let remainingCount = Math.max(0, this.members.length - 5);
        if (remainingCount) {
            return `and ${remainingCount} more`;
        }
        return '';
    }

    canGoBack() {
        return this._routerExtensions.canGoBack();
    }

    canEdit() {
        return this.group && this._currentUser && this.group.Owner === this._currentUser.Id;
    }

    onEdit() {
        let transition = utilities.getPageTransition();
        this._routerExtensions.navigate([`groups/${this.group.Id}/edit`], { transition });
    }

    getJoinBtnText() {
        let text = this.group.RequiresApproval ? 'Ask to join' : 'Join';
        if (this.canResendJoinRequest()) {
            text = 'Resend join request';
        }
        return text;
    }

    getDetailsText() {
        let isPublicText = this.group.IsPublic ? 'public' : 'private';
        let approvalText = this.group.RequiresApproval ? 'requires approval' : 'does not require approval';
        return `This group is ${isPublicText} and ${approvalText} to join.`;
    }

    onViewEvents() {
        let transition = utilities.getPageTransition();
        this._routerExtensions.navigate([`groups/${this.group.Id}/events`], { transition });
    }

    hasAnyJoinRequests() {
        return typeof this.requestCount === 'number' && this.requestCount > 0;
    }

    onViewRequests() {
        if (this.hasAnyJoinRequests()) {
            let transition = utilities.getPageTransition();
            this._routerExtensions.navigate([`groups/${this.group.Id}/join-requests`], { transition });
        }
    }

    onJoin(): Promise<any> {
        if (this._disableJoinBtn) {
            return Promise.resolve(false);
        }

        this._disableJoinBtn = true;
        this._joinGroup().catch((err) => {
            this._disableJoinBtn = false;
            this._alertsService.showError(err && err.message);
        });
    }

    onLeave() {
        this._alertsService.askConfirmation(`Leave ${this.group.Name}?`)
            .then(() => this._groupsService.leaveGroup(this.group.Id, this._currentUser.Id))
            .then(() => {
                this.hasJoined = false;
                this.members = this.members.filter(m => m.Id !== this._currentUser.Id);
                this.userApplication = null;
                this.membershipChanged = true;
                if (this._page.ios) {
                    this._hideIosBackBtn();
                }
             })
            .catch((err) => err && this._alertsService.showError(err.message));
    }

    onMembersTap() {
        if (this.members.length) {
            let transition = utilities.getPageTransition();
            this._routerExtensions.navigate([`/groups/${this.group.Id}/members`], { transition });
        }
    }

    onBack() {
        if (this._routerExtensions.canGoBack() && !this.membershipChanged) {
            this._routerExtensions.back();
        } else {
            let transition = utilities.getReversePageTransition();
            this._routerExtensions.navigate(['/groups'], { clearHistory: true, transition });
        }
    }

    getApplicationStatusText() {
        let text = 'Pending approval';
        if (this.userApplication && this.userApplication.Resolved) {
            text = 'Membership denied'; // cause if it was approved, they wouldn't see this message
        }
        return text;
    }

    canResendJoinRequest() {
        return this.userApplication && this.userApplication.Resolved && !this.userApplication.Approved && (utilities.plusTime(this.userApplication && this.userApplication.ModifiedAt, 5, 'minutes') <= new Date());
    }

    getApplicationStatusIcon() {
        let icon = '42';
        if (this.userApplication && this.userApplication.Resolved) {
            icon = '41';
        }
        return String.fromCharCode(parseInt(icon, 16));
    }

    showJoinBtn() {
        let hasNotJoined = this.hasJoined === false && !this.userApplication;
        return hasNotJoined || this.canResendJoinRequest();
    }

    toggleActions() {
        action({
            message: 'What would you like to do?',
            actions: ['Delete Group'],
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result === 'Delete Group') {
                this.deleteGroup();
            }
        });
    }

    showIf(shouldShow: boolean) {
        return utilities.showIf(shouldShow);
    }

    private _addCurrentUserAsRegistered() {
        this.hasJoined = true;
        let clone = this.members.slice(0);
        clone.push(this._currentUser);
        this.members = clone;
    }

    private _joinGroup() {
        return this._groupsService.joinGroup(this.group.Id, this._currentUser.Id)
            .then((resp) => {
                if (this.group.RequiresApproval) {
                    this._alertsService.showSuccess(`Request to join "${this.group.Name}" sent`);
                    this.userApplication = { Approved: false } as any;
                } else {
                    this._addCurrentUserAsRegistered();
                }
                this._disableJoinBtn = false;
                this.membershipChanged = true;
                if (this._platform.isIos) {
                    this._hideIosBackBtn();
                }
                return resp;
            });
    }

    private _hideIosBackBtn() {
        let ctrl = frameModule.topmost().ios.controller;
        ctrl.navigationItem.hidesBackButton = true;
        this._page.ios.navigationItem.hidesBackButton = true;
    }
}
