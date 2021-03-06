import { Component, OnInit, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RouterExtensions } from 'nativescript-angular/router';
import { Page } from 'ui/page';

import { GroupsService, AlertService, UsersService } from '../../services';
import { Group, utilities } from '../../shared';

@Component({
    moduleId: module.id,
    selector: 'groups',
    templateUrl: './groups.template.html',
    styleUrls: ['./groups.component.css']
})
export class GroupsComponent implements OnInit {
    publicGroups: Group[];
    userGroups: Group[];
    hasMoreUnjoined: boolean = true;
    hasMoreUserGroups: boolean = true;
    hasAnyGroups: boolean = null;
    private readonly _pageSize = 7;
    private _unjoinedPage = 0;
    private _userGroupsPage = 0;
    private _selectedIndex = 0;
    private _lockUnjoinedGroups = false;
    private _lockUserGroups = false;

    constructor(
        private _page: Page,
        private _route: ActivatedRoute,
        private _usersService: UsersService,
        private _groupsService: GroupsService,
        private _routerExtensions: RouterExtensions,
        private _alertService: AlertService
    ) {}

    ngOnInit() {
        this._page.actionBar.title = 'Groups';
        this._route.params.subscribe(p => {
            let setTabOnInit = 'selectedTabIndex' in p;
            let tabIndex = 0;
            if (setTabOnInit) {
                tabIndex = Number(p['selectedTabIndex']);
            }
            if (!isNaN(tabIndex) && tabIndex !== 0) {
                this.goToTab(tabIndex);
            }
            this._usersService.currentUser()
                .then(user => this._groupsService.getAllVisible(user.Id, true))
                .then(groupCount => this.hasAnyGroups = groupCount > 0)
                .catch(err => err && this._alertService.showError(err.message));
        });
    }

    set selectedIndex(val: number) {
        this._selectedIndex = val;
        if (this._selectedIndex === 0 && !this.userGroups) { // user groups open
            this._initialize(true);
        } else if (this._selectedIndex === 1 && !this.publicGroups) { // all groups open
            this._initialize(false);
        }
    }

    get selectedIndex() {
        return this._selectedIndex;
    }

    isInitialized() {
        return this.userGroups || this.publicGroups;
    }

    selectGroup(group: Group) {
        this._navigate(`/groups/${group.Id}`);
    }

    onAdd() {
        this._navigate('/groups/add');
    }

    goToTab(tabIndex: number) {
        this.selectedIndex = tabIndex;
    }

    loadMoreUserGroups() {
        if (!this.hasMoreUserGroups || this._lockUserGroups) {
            return Promise.resolve();
        }
        this._lockUserGroups = true;
        return this._usersService.currentUser()
            .then((u) => this._groupsService.getUserGroups(u.Id, this._userGroupsPage, this._pageSize))
            .then(groups => {
                this.userGroups = (this.userGroups || []).concat(groups);
                this.hasMoreUserGroups = this._hasMore(groups.length, this._pageSize);
                if (this.hasMoreUserGroups) {
                    this._userGroupsPage++;
                }
                this._lockUserGroups = false;
            })
            .catch(err => {
                this._lockUserGroups = false;
                this.hasMoreUserGroups = true
            });
    }

    loadMoresUnjoinedGroups() {
        if (!this.hasMoreUnjoined || this._lockUnjoinedGroups) {
            return Promise.resolve();
        }
        this._lockUnjoinedGroups = true;
        return this._usersService.currentUser()
            .then((u) => this._groupsService.getUnjoinedGroups(u.Id, this._unjoinedPage, this._pageSize))
            .then(groups => {
                this.publicGroups = (this.publicGroups || []).concat(groups);
                this.hasMoreUnjoined = this._hasMore(groups.length, this._pageSize);
                if (this.hasMoreUnjoined) {
                    this._unjoinedPage++;
                }
                this._lockUnjoinedGroups = false;
            })
            .catch(err => {
                this._lockUnjoinedGroups = false;
                this.hasMoreUnjoined = true;
            });
    }

    private _navigate(url: string) {
        let transition = utilities.getPageTransition();
        this._routerExtensions.navigate([url], { transition });
    }

    private _hasMore(receivedCount: number, pageSize: number) {
        return receivedCount === pageSize;
    }

    private _initialize(loadUserGroups) {
        let promise: Promise<any>;
        if (loadUserGroups) {
            promise = this.loadMoreUserGroups();
        } else {
            promise = this.loadMoresUnjoinedGroups();
        }
        return promise.catch(err => err && this._alertService.showError(err.message));
    }
}
