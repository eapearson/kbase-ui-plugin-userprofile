/*
Profile model:

user
    usernmae (set from auth2 account)
    realname (synced from auth2 account)
userdata
    organization
    department
    jobTitle
    jobTitleOther
    affiliations
        title
        organization
        started
        ended
    city
    state
    zip
    country
    researchInterests
    primaryFundingSource
    researchStatement
    avatarOption
    gravatarDefault
synced
    gravatarHash
preferences

*/
define([
    'knockout',
    'kb_knockout/registry',
    'kb_knockout/lib/generators',
    'kb_lib/html',
    'kb_lib/htmlBuilders',
    'kb_lib/htmlBootstrapBuilders',
    'kb_plugin_user-profile'
], function (
    ko,
    reg,
    gen,
    html,
    build,
    BS,
    Plugin
) {
    'use strict';

    /*
        incoming params is a raw user profile. We turn that into a view model
    */
    class ViewModel {
        constructor(params) {
            this.userProfile = params.profile;
            if (!this.userProfile.profile) {
                this.userProfile.profile = {
                    userdata: {}
                };
            } else if (!this.userProfile.profile.userdata) {
                this.userProfile.profile.userdata = {};
            }
            this.gravatarUrl = ko.pureComputed(() => {
                return this.buildAvatarUrl();
            });
            this.researchStatementDisplay = ko.pureComputed(() => {
                var text = build.safeText(this.userProfile.profile.userdata.researchStatement);
                if (!text) {
                    return '';
                }
                return text.replace(/\n/g, '<br>');
            });
            this.authToken = this.getAuthToken();
            this.Orgs = ko.observableArray();
            this.fetchOrgs(this.authToken).then(orgs => {
                // @ param {orgs} array of org names
                let arr = [];
                orgs.forEach(org=>{
                    arr.push(org.name);
                })
                this.Orgs(arr)
                return null;
            })
        }

        /**
         * get Authrization token from session cookies. 
         */
        getAuthToken(){
            let cookies = window.document.cookie.split(';');
            let token = "";
            cookies.forEach(cookie => {
                if(cookie.split('=')[0].trim() === "kbase_session") {
                    token = cookie.split('=')[1].trim()
                }
            });
            return token;
        }

        /**
         * fetch organization details. 
         * @param {string} org  group ID
         */
        fetchGroupInfo(org) {
            let groupUrl = "https://ci.kbase.us/services/groups/group/"+org.id;
            return fetch(groupUrl, {
                method: "GET",
                mode: "cors",
                json: true,
                headers:{
                    "Authorization": this.authToken,
                    "Content-Type": "application/json",
                },
            })
            .then(response => response.json())
            .then(response => {
               return response;
            })
            .catch(error => console.error('Error while fetching group info:', error));
        }

        /**
         * fetch organizations that user is associated.
         * @param {string} token  authorization token
         */
        
        fetchOrgs(token) {
            let groupUrl = "https://ci.kbase.us/services/groups/member/";
            return fetch(groupUrl, {
                method: "GET",
                mode: "cors",
                json: true,
                headers:{
                    "Authorization": token,
                    "Content-Type": "application/json",
                },
            })
            .then(response => response.json())
            .then(response => {
                return Promise.all(response.map(group => this.fetchGroupInfo(group)));
            })
            .then(groupInfos => {
                // groupInfos is an array of all the groups the current user is in
                // Find all the groups that the profile user is a member, admin, or owner of.
                const userGroups = groupInfos.filter(group => {
                    const allPeople = [group.owner].concat(group.admins).concat(group.members);
                    const memberOf = allPeople.filter(m => {
                        return m.name === this.userProfile.user.username
                    });
                    return memberOf.length;
                });
                return userGroups;
            })
            .catch(error => console.error('Error while fetching groups associated with the user:', error));
        }
        
        buildAvatarUrl() {
            switch (this.userProfile.profile.userdata.avatarOption || 'gravatar') {
            case 'gravatar':
                var gravatarDefault = this.userProfile.profile.userdata.gravatarDefault || 'identicon';
                var gravatarHash = this.userProfile.profile.synced.gravatarHash;
                if (gravatarHash) {
                    return 'https://www.gravatar.com/avatar/' + gravatarHash + '?s=500&amp;r=pg&d=' + gravatarDefault;
                } else {
                    return Plugin.plugin.fullPath + '/images/nouserpic.png';
                }
            case 'silhouette':
            case 'mysteryman':
            default:
                return Plugin.plugin.fullPath + '/images/nouserpic.png';
            }
        }
    }

    // VIEW

    const t = html.tag,
        div = t('div'),
        span = t('span'),
        p = t('p'),
        img = t('img'),
        h2 = t('h2'),
        h3 = t('h3'),
        ul = t('ul'),
        li = t('li');

    function buildResearchInterests() {
        return [
            h3('Research Interests'),
            div({
                dataBind: {
                    visible: 'researchInterests.length === 0'
                },
                style: {
                    fontStyle: 'italic'
                }
            }, 'No research interests selected'),
            ul({
                dataBind: {
                    foreach: 'researchInterests'
                }
            }, li([
                span({
                    dataBind: {
                        text: '$data'
                    }
                }),
                gen.if('$data === "Other"',
                    span({
                        dataBind: {
                            text: '" - " + ($component.userProfile.profile.userdata.researchInterestsOther || "")'
                        }
                    }))
            ]))
        ];
    }

    function buildFundingSource() {
        return [
            h3('Primary Funding Source'),
            div({
                dataBind: {
                    text: 'fundingSource'
                }
            })
        ];
    }

    function buildAffiliations() {
        return [
            h3('Affiliations'),
            div({
                dataBind: {
                    visible: 'affiliations.length === 0'
                },
                style: {
                    fontStyle: 'italic'
                }
            }, 'No affiliations provided'),
            ul({
                dataBind: {
                    visible: 'affiliations.length > 0',
                    foreach: 'affiliations'
                }
            }, li([
                p([
                    span({
                        dataBind: {
                            text: 'title'
                        }
                    }),
                    ' (',
                    span({
                        dataBind: {
                            text: 'started'
                        }
                    }),
                    ' - ',
                    gen.if('$data.ended',
                        span({
                            dataBind: {
                                text: 'ended'
                            }
                        }),
                        span('present')),
                    ') ',
                    ' @ ',
                    span({
                        dataBind: {
                            text: 'organization'
                        }
                    })
                ])
            ]))
        ];
    }

    function buildResearchStatement() {
        return [
            h3('Research or Personal Statement'),
            div({
                dataBind: {
                    visible: '$component.researchStatementDisplay().length === 0'
                },
                style: {
                    fontStyle: 'italic'
                }
            }, 'No research statement provided'),
            div({
                class: 'well',
                dataBind: {
                    visible: '$component.researchStatementDisplay().length > 0',
                    html: '$component.researchStatementDisplay()'
                }
            })
        ];
    }

    function buildLocation() {
        gen.if('country === "United States"', [
            div([
                span({
                    dataBind: {
                        text: 'city'
                    }
                }),
                ', ',
                span({
                    dataBind: {
                        text: 'state'
                    }
                }),
                span({
                    dataBind: {
                        text: 'postalCode'
                    },
                    style: {
                        marginLeft: '10px'
                    }
                })
            ]),
            div({
                dataBind: {
                    text: 'country'
                }
            })
        ], [
            div({
                dataBind: {
                    text: 'city'
                }
            }),
            div({
                dataBind: {
                    text: 'state'
                }
            }),
            div({
                dataBind: {
                    text: 'postalCode'
                }
            }),
            div({
                dataBind: {
                    text: 'country'
                }
            })
        ]);
    }

    function buildProfilePanel() {
        return BS.buildPanel({
            type: 'default',
            attributes: {
                dataKBTesthookPanel: 'profile'
            },
            title: span([
                span({
                    dataBind: {
                        text: 'userProfile.user.realname'
                    }
                }),
                ' (',
                span({
                    dataKBTesthookField: 'username',
                    dataBind: {
                        text: 'userProfile.user.username'
                    }
                }),
                ')'
            ]),
            body: div({
                class: 'row'
            }, [
                div({
                    class: 'col-md-3'
                }, img({
                    style: {
                        width: '100%'
                    },
                    dataBind: {
                        attr: {
                            src: 'gravatarUrl()'
                        }
                    }
                })),
                div({
                    class: 'col-md-4'
                }, [
                    h2(
                        {dataBind: {
                            text: 'userProfile.user.realname'
                        }
                    }),
                    gen.if('$data.userProfile.profile.userdata',
                        gen.with('$data.userProfile.profile.userdata', [
                            div({
                                style: {
                                    fontStyle: 'italic',
                                    marginBottom: '1em'
                                }
                            }, [
                                gen.if('$data.jobTitle',
                                    gen.if('jobTitle !== "Other"',
                                        span({
                                            dataBind: {
                                                text: 'jobTitle'
                                            }
                                        }),
                                        span({
                                            dataBind: {
                                                text: 'jobTitleOther'
                                            }
                                        })))
                            ]),

                            gen.if('$data.organization',
                                div({
                                    dataBind: {
                                        text: 'organization'
                                    }
                                })),

                            gen.if('$data.department',
                                div({
                                    dataBind: {
                                        text: 'department'
                                    }
                                })),

                            buildLocation(),

                            gen.if('$data.researchInterests && $data.researchInterests.length > 0',
                                buildResearchInterests()),

                            gen.if('$data.fundingSource && $data.fundingSource.length > 0',
                                buildFundingSource()),

                            gen.if('$data.affiliations &&  $data.affiliations.length > 0',
                                buildAffiliations()),

                            gen.if('$component.researchStatementDisplay().length > 0',
                                buildResearchStatement())
                        ]))
                ]),
                div({
                    class: 'col-md-5'
                }, [
                    h3("Oraganizations"),
                    ul({
                        dataBind: {
                            foreach:'Orgs'
                        }
                    }, [li({
                        dataBind: {
                            text: "$data" 
                        }
                    })])
                ])
            ])
        });
    }

    function template() {
        return div({
            dataKBTesthookComponent: 'profile-view'
        }, buildProfilePanel());
    }

    function component() {
        return {
            template: template(),
            viewModel: ViewModel
        };
    }

    // note that this component is also provided as a globally known component: 'profile-view'
    return reg.registerComponent(component);
});