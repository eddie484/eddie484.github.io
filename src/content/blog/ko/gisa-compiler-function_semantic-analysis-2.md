---
title: 'GISA Compiler: Function_Semantic Analysis (2)'
description: |-
  지난 글에 이어서 함수의 의미분석 진행중이다. 타입 체킹 만들 차례.


   목표
  함수의 타입을 저장하고, 재선언 및 호출 시 비교해야 한다.


   구현 과정

  우선, 기존에는 심볼의 id를 리턴하던 symbolfin
category: journal
pubDate: 2026-07-16T15:34
---

지난 글에 이어서 함수의 의미분석 진행중이다. 타입 체킹 만들 차례.

### 목표

함수의 타입을 저장하고, 재선언 및 호출 시 비교해야 한다.

### 구현 과정

우선, 기존에는 심볼의 id를 리턴하던 symbol_finder를, 타입트리 비교 및 함수 여부 확인 등에도 사용할 수 있도록 Symbol_info 자체를 리턴하도록 개선했다.

그리고는 ast의 함수 선언/사용 형태에서 기존 구상했던 타입트리의 형태를 뽑아낼 수 있는 함수를 만들었다.

```plain
Node * get_type_tree_from_func_declr(Node * declr_node, Node * ident_node) {
    // return_type-param1_type-param2_type-param3_type....
    Node * type_tree = node_maker(node_maker(NULL, NULL, declr_node->son->token.token_number, 0), NULL, SEM_TYPE, 0);
    Node * type_tree_current = type_tree;
    Node * param_node = ident_node->brother->son;
    while (param_node != NULL) {
        Node * param_node_son_holder = param_node->son;
        Node * param_node_type_holder = node_maker(NULL, NULL, param_node_son_holder->token.token_number, param_node_son_holder->token.token_value);
        param_node_son_holder = param_node_son_holder->brother;
        while (param_node_son_holder != NULL && param_node_son_holder->token.token_number != IDENT) {
        param_node_type_holder->brother = node_maker(NULL, NULL, param_node_son_holder->token.token_number, param_node_son_holder->token.token_value);
            param_node_son_holder = param_node_son_holder->brother;
            param_node_type_holder = param_node_type_holder->brother;
        }

        type_tree_current->brother = node_maker(param_node_type_holder, NULL, SEM_TYPE, 0);
        type_tree_current = type_tree_current->brother;

        param_node = param_node->brother;
    }

    return type_tree;
}

Node * get_type_tree_from_func_call(Node * ident_node) {
    // arg1_type-arg2type-arg3type...
    Node * param_node = ident_node->brother->son;
    Node * type_tree = node_maker(NULL, NULL, SEM_TYPE, 0);
    Node * type_tree_current = type_tree;
    while (param_node != NULL) {
        Node * param_return_type;
        if (symbol_finder(param_node->son)->is_func == 1) {
            param_return_type = symbol_finder(param_node->son)->type_tree->son;
        } else {
            param_return_type = symbol_finder(param_node->son)->type_tree;
        }
        Node * param_node_type = copy_tree(param_return_type);

        type_tree_current->brother = node_maker(param_node_type, NULL, SEM_TYPE, 0);
        type_tree_current = type_tree_current->brother;
        param_node = param_node->brother;
    }

    type_tree_current = type_tree->brother;
    free(type_tree);

    return type_tree_current;

}
```

func_declr에서 가져온 타입 트리는 SEM_TYPE이 brother로 묶여 있으며, 각각은 return type, 인자 1의 타입, 인자 2의 타입... 을 자식으로 가지고 있는 구조이다.
func_call은, 리턴 타입이 없는 대신, 인자로 함수호출이 올 수 있는 구조이다. 또한 인자 부분에서 IDENT 선언은 불가능하다. 따라서 ast에서 타입을 가져올 때는, symbol_finder()를 이용해 해당 symbol의 타입을 가져와 사용하도록 구현했다.

이제 저 함수들을 이용해, 함수 선언에서 심볼에 타입트리 저장, 재선언과 호출 과정에서 타입 비교를 진행할 것이다.

먼저 함수 선언이다.

```plain
symbol->type_tree = node_maker(NULL, NULL, NUM_INT, 0);    // 이후 확장할 것. 형식도 enum으로 개선하고...
```

기존에는 이렇게 더미용 NUM_INT 타입만 들어가던 것을,

```plain
symbol->type_tree = get_type_tree_from_func_declr(declr_node, ident_node);
```

함수 사용으로 바꿔 제대로 된 타입트리가 저장되도록 수정했다.

다음으로는 함수 재선언에서 타입트리 비교이다. 비교에 앞서, 두 개의 헬퍼 함수를 만들었다.

```plain
Node * copy_tree(Node * node) {
    Node * n = node_maker(NULL, NULL, node->token.token_number, node->token.token_value);

    if (node->son != NULL) {
        n->son = copy_tree(node->son);
    }

    if (node->brother != NULL) {
        n->brother = copy_tree(node->brother);
    }

    return n;
}

int compare_tree(Node * node_A, Node * node_B) {
    if (node_A == NULL && node_B == NULL) {
        return 1;
    } else if ((node_A != NULL && node_B == NULL) || (node_A == NULL && node_B != NULL)) {
        return 0;
    }

    int result;
    int result_son;
    int result_brother;
    if (node_A->token.token_number == node_B->token.token_number && node_A->token.token_value == node_B->token.token_value) {
        result = 1;
    } else {
        result = 0;
    }

    if ((node_A->son != NULL && node_B->son == NULL) || (node_A->son == NULL && node_B->son != NULL) || (node_A->brother != NULL && node_B->brother == NULL) || (node_A->brother == NULL && node_B->brother != NULL)) {
        return 0;
    }

    if (node_A->son != NULL && node_B->son != NULL) {
        result_son = compare_tree(node_A->son, node_B->son);
    } else {
        result_son = 1;
    }

    if (node_A->brother != NULL && node_B->brother != NULL) {
        result_brother = compare_tree(node_A->brother, node_B->brother);
    } else {
        result_brother = 1;
    }

    return (result && result_son && result_brother);
```

compare_tree는 두 노드를 인자로 받아, 자신과 son, brother까지 전부 훑으며 두 트리를 비교한다.

이 두 함수를 이용해, 함수 재선언에서 타입 비교를 진행했다.

```plain
                if (compare_tree(get_type_tree_from_func_declr(declr_node, ident_node), func_table[j]->type_tree) == 0) {
                    printf("오류: 이전에 선언된 함수의 타입과 다른 타입으로 선언되었습니다.\n");
                    printf("이전에 선언된 함수의 타입 트리:\n");
                    bin_tree_printer(func_table[j]->type_tree);
                    printf("새로 선언된 함수의 타입 트리:\n");
                    bin_tree_printer(get_type_tree_from_func_declr(declr_node, ident_node));
                    exit(1);
                } else {
                    printf("정상:이전에 선언된 함수의 타입과 같은 타입으로 선언되었습니다.\n");
                }
```

func_table에서 IDENT name과 같은 심볼을 찾은 뒤, 입력된 IDENT 노드의 인자들로 타입 트리를 만들고, 이를 심볼의 타입 트리와 compare한다.

```plain
                if (symbol_table_stack[i][j]->is_func == 1) {
                    if (compare_tree(get_type_tree_from_func_call(ident_node), symbol_table_stack[i][j]->type_tree->brother) == 0) {
                        printf("오류: 이전에 선언된 함수의 인자 타입과 다른 타입의 인자들로 호출하고 있습니다.\n");
                        printf("이전에 선언된 함수의 인자 타입 트리:\n");
                        bin_tree_printer(func_table[j]->type_tree->brother);
                        printf("호출하는 함수의 인자 타입 트리:\n");
                        bin_tree_printer(get_type_tree_from_func_call(ident_node));
                        exit(1);
                    } else {
                        printf("정상:이전에 선언된 함수의 인자와 같은 인자로 호출했습니다.\n");
                    }
                }
```

함수 호출에서는, 심볼 타입 트리의 brother와 검사한다. 호출 트리는 리턴 타입 없이 인자 타입들만 기록되어 있기 때문이다.

### 구현 후 발견한 문제

여기까지 진행 후 테스트해본 결과, 정상적인 인자를 가진 함수 호출조차도 타입트리 불일치로 감지했다.

\*\*\* Binary tree print start \*\*\*
<151, 0>
        <2, 0>
<151, 0>
        <2, 0>

\*\*\* Binary tree print start \*\*\*
<151, 0>
        <1, 0>
<151, 0>
        <1, 0>

KW_INT와 NUM_INT를 다르게 인식하는 것이 문제의 원인이다. 아까 함수 심볼의 타입트리 저장을 수정할 때, 변수 심볼은 고치지 않았기에. 함수 심볼에서는 ast의 타입 넘버 그대로 저장해 KW_INT가 저장된 것이다. 하지만 변수 심볼은 그대로 NUM_INT를 저장하고 있었고, 함수 호출의 타입트리는 인자들의 심볼 타입트리를 가져다가 구성하기 때문에, NUM_INT가 들어간 것이다.

이를 고치기 위해, 변수 심볼 생성의 타입트리 저장을 수정했다.

```plain
Node * get_type_tree_from_var_declr(Node * declr_node, Node * ident_node) {
    // return_type-param1_type-param2_type-param3_type....
    Node * type_tree = node_maker(NULL, NULL, declr_node->son->token.token_number, 0);

    return type_tree;
}
```

현재는 변수의 타입은 하나만 올 수 있으므로, 이후 확장 가능하도록 간단하게 만들었다. 이 var_declr 함수로 변수의 타입 트리를 저장하도록 수정하자, 함수 호출 타입트리도 KW_INT를 사용하게 되어 문제가 해결되었다.

두 번째 문제로는, 인자가 void인 함수의 호출이다. ast 상으로는 인자가 없는 함수 호출은 변수 호출과 구분이 되지 않는 문제가 있었다. 이를 해결하기 위해, parser를 수정해 인자가 없는 함수의 경우에도 빈 ARG_LIST 노드를 붙여주고, func_call_tree 함수에서는 param_node가 NULL인 경우 KW_VOID를 인자로 넣어주어, 함수정의 타입트리와 같은 타입트리가 나오도록 만들어 주었다.
