#!/usr/bin/python
"""Print a test spec on stdout.

Each line has parameters for a test case.  The regtest.sh shell script reads
these lines and runs parallel processes.

We use Python data structures so the test cases are easier to read and edit.
"""

import optparse
import sys

#
# TEST CONFIGURATION
#

DEMO = (
    # (case_name distr num_unique_values num_clients values_per_client)
    # (num_bits num_hashes num_cohorts)
    # (p q f) (num_additional regexp_to_remove)
    ('demo1 gauss   100 100000 1', '32 1 64', '0.25 0.75 0.5', '0 NONE'),
    ('demo2 gauss   100 1000 1', '32 1 64', '0.25 0.75 0.5', '0 NONE'),
    ('demo3 gauss   100 10000 1', '32 1 64', '0.25 0.75 0.5', '0 NONE'),
    ('demo4 zipf1   100 100000 10', '32 1 64', '0.25 0.75 0.5', '100 v[0-9]*9$'),
    ('demo5 zipf1.5 100 100000 10', '32 1 64', '0.25 0.75 0.5', '100 v[0-9]*9$'),
)

DISTRIBUTIONS = (
    'unif',
    'exp',
    'gauss',
    'zipf1',
    'zipf1.5',
)

DISTRIBUTION_PARAMS = (
    # name, num unique values, num clients, values per client
    ('tiny', 100, 10000, 1),  # test for insufficient data
    ('tiny2', 3, 800, 1),  # test for insufficient data
    ('small', 100, 1000000, 1),
    ('small2', 10000, 1000000, 1),
    ('small3', 10, 1000000, 1),
    ('medium', 1000, 10000000, 1),
    ('medium2', 100, 10000000, 1),
    ('medium3', 10000, 10000000, 1),
    ('large', 10000, 100000000, 1),

    # Params for testing how varying the number of clients affects the results
    ('clients1', 100, 10000000, 1),
    ('clients2', 100, 1000000, 1),
    ('clients3', 100, 500000, 1),
    ('clients4', 100, 100000, 1),
    ('clients5', 100, 50000, 1),
    ('clients6', 100, 25000, 1),
    # Params for testing how varying the number of values per clients affects the results
    ('values1', 100, 25000, 400),
    ('values2', 100, 25000, 40),
    ('values3', 100, 25000, 20),
    ('values4', 100, 25000, 4),
    ('values5', 100, 25000, 2),
    ('values6', 100, 25000, 1),
    # Params for testing the number of unique values
    ('unique1', 10, 1000000, 1),
    ('unique2', 50, 1000000, 1),
    ('unique3', 100, 1000000, 1),
    ('unique4', 250, 1000000, 1),
    ('unique5', 500, 1000000, 1),
    ('unique6', 750, 1000000, 1),
    ('unique7', 1000, 1000000, 1),
    ('unique8', 2000, 1000000, 1),
    ('unique9', 5000, 1000000, 1),
    #
    ('unique10', 10, 10000000, 1),
    ('unique11', 50, 10000000, 1),
    ('unique12', 100, 10000000, 1),
    ('unique13', 250, 10000000, 1),
    ('unique14', 500, 10000000, 1),
    ('unique15', 750, 10000000, 1),
    ('unique16', 1000, 10000000, 1),
    ('unique17', 2000, 10000000, 1),
    ('unique18', 5000, 10000000, 1),

    ('cohort', 10000, 10000000, 1),

)

# 'k, h, m' as in params file.
BLOOMFILTER_PARAMS = {
    '8x16x2': (8, 2, 16),  # 16 cohorts, 8 bits each, 2 bits set in each
    '8x32x2': (8, 2, 32),  # 32 cohorts, 8 bits each, 2 bits set in each
    '8x128x2': (8, 2, 128),  # 128 cohorts, 8 bits each, 2 bits set in each
    '128x8x2': (128, 2, 8),  # 8 cohorts, 128 bits each, 2 bits set in each
    '32x64x1': (32, 1, 64), # 64 cohorts, 32 bit each, 1 bits set in each
    '32x2x1': (32, 1, 2), # 2 cohort, 32 bit each, 1 bits set in each
    '32x64x2': (32, 2, 64), # 64 cohorts, 32 bit each, 1 bits set in each

    '128x100x2': (128, 2, 100), # 100 cohorts, 128 bit each, 2 bits set in each

    # params for testing the size of the bloom filter
    '4x32x2': (4, 2, 32),  # 32 cohorts, 4 bits each, 2 bits set in each
    '8x32x2': (8, 2, 32),  # 32 cohorts, 8 bits each, 2 bits set in each
    '16x32x2': (16, 2, 32),  # 32 cohorts, 16 bits each, 2 bits set in each
    '32x32x2': (32, 2, 32),  # 32 cohorts, 32 bits each, 2 bits set in each
    '64x32x2': (64, 2, 32),  # 32 cohorts, 64 bits each, 2 bits set in each
    '128x32x2': (128, 2, 32),  # 32 cohorts, 128 bits each, 2 bits set in each
    '256x32x2': (256, 2, 32),  # 32 cohorts, 256 bits each, 2 bits set in each

    '4x128x2' :(4, 2, 128),
    '16x128x2':(16, 2, 128),
    '32x128x2':(32, 2, 128),
    '64x128x2':(64, 2, 128),
    '128x128x2':(128, 2, 128),
    '256x128x2':(256, 2, 128),
    
    # with different number of cohorts
    '8x2x2': (8, 2, 2),  
    '8x4x2': (8, 2, 4),  
    '8x8x2': (8, 2, 8), 
    '8x16x2': (8, 2, 16),  
    '8x32x2': (8, 2, 32),
    '8x64x2': (8, 2, 64),  
    '8x256x2': (8, 2, 256),

    # with different number of hash functions
    '4x32x4': (4, 4, 32),  # 32 cohorts, 4 bits each, 4 bits set in each
    '8x32x4': (8, 4, 32),  # 32 cohorts, 8 bits each, 4 bits set in each
    '16x32x4': (16, 4, 32),  # 32 cohorts, 16 bits each, 4 bits set in each
    '32x32x4': (32, 4, 32),  # 32 cohorts, 32 bits each, 4 bits set in each
    '64x32x4': (64, 4, 32),  # 32 cohorts, 64 bits each, 4 bits set in each
    '128x32x4': (128, 4, 32),  # 32 cohorts, 128 bits each, 4 bits set in each
    '256x32x4': (256, 4, 32),  # 32 cohorts, 256 bits each, 4 bits set in each
    #
    '4x128x4': (4, 4, 128),  # 128 cohorts, 4 bits each, 4 bits set in each
    '8x128x4': (8, 4, 128),  # 128 cohorts, 8 bits each, 4 bits set in each
    '16x128x4': (16, 4, 128),  # 128 cohorts, 16 bits each, 4 bits set in each
    '32x128x4': (32, 4, 128),  # 128 cohorts, 32 bits each, 4 bits set in each
    '64x128x4': (64, 4, 128),  # 128 cohorts, 64 bits each, 4 bits set in each
    '128x128x4': (128, 4, 128),  # 128 cohorts, 128 bits each, 4 bits set in each
    '256x128x4': (256, 4, 128),  # 128 cohorts, 256 bits each, 4 bits set in each

    # params for testing the number of hash functions
    '8x128x1' : (8, 1, 128),
    '8x128x4' : (8, 4, 128),
    '8x128x8' : (8, 8, 128),
    '8x128x16' : (8, 16, 128),

    '256x128x1':(256, 1, 128),
    '256x128x4':(256, 4, 128),
    '256x128x8':(256, 8, 128),
    '256x128x16':(256, 16, 128),

}

# 'p, q, f' as in params file.
PRIVACY_PARAMS = {
    # others
    'params1': (0.39, 0.61, 0.45),  # eps_1 = 1, eps_inf = 5:
    'params2': (0.225, 0.775, 0.0),  # eps_1 = 5, no eps_inf
     
    # default
    'params3': (0.5, 0.75, 0.0), 

    # hash functions (they have the equivalent to 2*ln(3) DP level when used with the correct number of hash functions)
    'params4': (0.3, 0.7941, 0.0), # 1 hash function
    'params5': (0.313, 0.441, 0.0), # 4 hash functions
    'params6': (0.313, 0.37486, 0.0), # 8 hash functions
    'params7': (0.313, 0.3436, 0.0), # 16 hash functions

    # testing probabilities
    'params8': (0.467, 0.75, 0.1), 
    'params9': (0.3999, 0.889, 0.5), 
    'params10': (0.695, 0.9043, 0.2), 
    'params11': (0.186, 0.407, 0.0), 

    #
    'params12': (0.5, 0.75, 0.75),
    'params13': (0.25, 0.75, 0.5),
    'params14': (0.35, 0.65, 0.0),

}

# For deriving candidates from true inputs.
MAP_REGEX_MISSING = {
    'sharp': 'NONE',  # Categorical data
    '10%': 'v[0-9]*9$',  # missing every 10th string
}

# test configuration ->
#   (name modifier, Bloom filter, privacy params, fraction of extra,
#    regex missing)
TEST_CONFIGS = [
    ('typical', '8x128x2', 'params1', .2, '10%'),
    ('sharp', '8x128x2', 'params1', .0, 'sharp'),  # no extra candidates
    ('loose', '8x128x2', 'params2', .2, '10%'),  # loose privacy
    ('over_x2', '8x128x2', 'params1', 2.0, '10%'),  # overshoot by x2
    ('over_x10', '8x128x2', 'params1', 10.0, '10%'),  # overshoot by x10
    ('sharp2', '8x128x2', 'params3', .0, 'sharp'),
    ('sharp3', '32x64x1', 'params3', .0, 'sharp'),
    ('sharp4', '32x2x1', 'params3', .0, 'sharp'),
    ('sharp5', '32x64x2', 'params3', .0, 'sharp'),
    #
    ('sim_extra_1_1', '8x128x2', 'params3', .0, 'sharp'),
    ('sim_extra_1_2', '8x128x2', 'params3', .1, 'sharp'),
    ('sim_extra_1_3', '8x128x2', 'params3', .25, 'sharp'),
    ('sim_extra_1_4', '8x128x2', 'params3', .5, 'sharp'),
    ('sim_extra_1_5', '8x128x2', 'params3', .75, 'sharp'),
    ('sim_extra_1_6', '8x128x2', 'params3', 1., 'sharp'),
    ('sim_extra_1_7', '8x128x2', 'params3', 2., 'sharp'),
    ('sim_extra_1_8', '8x128x2', 'params3', 5., 'sharp'),
    ('sim_extra_1_9', '8x128x2', 'params3', 10., 'sharp'),

    # configuration for testing the bloom filter size
    ('sim_bloom_filter1_1', '4x32x2', 'params3', .0, 'sharp'),
    ('sim_bloom_filter1_2', '8x32x2', 'params3', .0, 'sharp'),
    ('sim_bloom_filter1_3', '16x32x2', 'params3', .0, 'sharp'),
    ('sim_bloom_filter1_4', '32x32x2', 'params3', .0, 'sharp'),
    ('sim_bloom_filter1_5', '64x32x2', 'params3', .0, 'sharp'),
    ('sim_bloom_filter1_6', '128x32x2', 'params3', .0, 'sharp'),
    ('sim_bloom_filter1_7', '256x32x2', 'params3', .0, 'sharp'),
     #
    ('sim_bloom_filter2_1', '4x128x2', 'params3', .0, 'sharp'),
    ('sim_bloom_filter2_2', '8x128x2', 'params3', .0, 'sharp'),
    ('sim_bloom_filter2_3', '16x128x2', 'params3', .0, 'sharp'),
    ('sim_bloom_filter2_4', '32x128x2', 'params3', .0, 'sharp'),
    ('sim_bloom_filter2_5', '64x128x2', 'params3', .0, 'sharp'),
    ('sim_bloom_filter2_6', '128x128x2', 'params3', .0, 'sharp'),
    ('sim_bloom_filter2_7', '256x128x2', 'params3', .0, 'sharp'),
    #
    ('sim_bloom_filter3_1', '4x32x4', 'params3', .0, 'sharp'),
    ('sim_bloom_filter3_2', '8x32x4', 'params3', .0, 'sharp'),
    ('sim_bloom_filter3_3', '16x32x4', 'params3', .0, 'sharp'),
    ('sim_bloom_filter3_4', '32x32x4', 'params3', .0, 'sharp'),
    ('sim_bloom_filter3_5', '64x32x4', 'params3', .0, 'sharp'),
    ('sim_bloom_filter3_6', '128x32x4', 'params3', .0, 'sharp'),
    ('sim_bloom_filter3_7', '256x32x4', 'params3', .0, 'sharp'),
    # 
    ('sim_bloom_filter4_1', '4x128x4', 'params3', .0, 'sharp'),
    ('sim_bloom_filter4_2', '8x128x4', 'params3', .0, 'sharp'),
    ('sim_bloom_filter4_3', '16x128x4', 'params3', .0, 'sharp'),
    ('sim_bloom_filter4_4', '32x128x4', 'params3', .0, 'sharp'),
    ('sim_bloom_filter4_5', '64x128x4', 'params3', .0, 'sharp'),
    ('sim_bloom_filter4_6', '128x128x4', 'params3', .0, 'sharp'),
    ('sim_bloom_filter4_7', '256x128x4', 'params3', .0, 'sharp'),

    # configuration for testing the number of hash functions
    ('sim_hash1_1', '8x128x1', 'params3', .0, 'sharp'),
    ('sim_hash1_2', '8x128x2', 'params4', .0, 'sharp'),
    ('sim_hash1_3', '8x128x4', 'params5', .0, 'sharp'),
    ('sim_hash1_4', '8x128x8', 'params6', .0, 'sharp'),
    ('sim_hash1_5', '8x128x16', 'params7', .0, 'sharp'),


    ('sim_hash2_1', '256x128x1', 'params3', .0, 'sharp'),
    ('sim_hash2_2', '256x128x2', 'params4', .0, 'sharp'),
    ('sim_hash2_3', '256x128x4', 'params5', .0, 'sharp'),
    ('sim_hash2_4', '256x128x8', 'params6', .0, 'sharp'),
    ('sim_hash2_5', '256x128x16', 'params7', .0, 'sharp'),

    # configuration for testing the number of cohorts
    ('sim_cohort1_1', '8x2x2', 'params3', .0, 'sharp'),
    ('sim_cohort1_2', '8x4x2', 'params3', .0, 'sharp'),
    ('sim_cohort1_3', '8x8x2', 'params3', .0, 'sharp'),
    ('sim_cohort1_4', '8x16x2', 'params3', .0, 'sharp'),
    ('sim_cohort1_5', '8x32x2', 'params3', .0, 'sharp'),
    ('sim_cohort1_6', '8x64x2', 'params3', .0, 'sharp'),
    ('sim_cohort1_7', '8x128x2', 'params3', .0, 'sharp'),
    ('sim_cohort1_8', '8x256x2', 'params3', .0, 'sharp'),

    ('sim_cohort2_1', '8x2x2', 'params3', .0, 'sharp'),
    ('sim_cohort2_2', '8x4x2', 'params3', .0, 'sharp'),
    ('sim_cohort2_3', '8x8x2', 'params3', .0, 'sharp'),
    ('sim_cohort2_4', '8x16x2', 'params3', .0, 'sharp'),
    ('sim_cohort2_5', '8x32x2', 'params3', .0, 'sharp'),
    ('sim_cohort2_6', '8x64x2', 'params3', .0, 'sharp'),
    ('sim_cohort2_7', '8x128x2', 'params3', .0, 'sharp'),
    ('sim_cohort2_8', '8x256x2', 'params3', .0, 'sharp'),
    # configuration for testing different probabilities p, q, f
    ('sim_probs1_1', '8x128x2', 'params3', .0, 'sharp'),
    ('sim_probs1_2', '8x128x2', 'params8', .0, 'sharp'),
    ('sim_probs1_3', '8x128x2', 'params9', .0, 'sharp'),
    ('sim_probs1_4', '8x128x2', 'params10', .0, 'sharp'),
    ('sim_probs1_5', '8x128x2', 'params11', .0, 'sharp'),

    #
    ('sim_case_scenario_1', '16x128x2', 'params12', .0, 'sharp'),
    ('sim_case_scenario_2', '16x128x2', 'params13', .0, 'sharp'),

    #
    ('sim_final', '128x100x2', 'params14', .0, 'sharp'),
    ('sim_final2', '8x16x2', 'params14', .0, 'sharp'),


]

#
# END TEST CONFIGURATION
#


def main(argv):
  rows = []

  test_case = []
  for (distr_params, num_values, num_clients,
       num_reports_per_client) in DISTRIBUTION_PARAMS:
    for distribution in DISTRIBUTIONS:
      for (config_name, bloom_name, privacy_params, fr_extra,
           regex_missing) in TEST_CONFIGS:
        test_name = 'r-{}-{}-{}'.format(distribution, distr_params,
                                        config_name)

        params = (BLOOMFILTER_PARAMS[bloom_name]
                  + PRIVACY_PARAMS[privacy_params]
                  + tuple([int(num_values * fr_extra)])
                  + tuple([MAP_REGEX_MISSING[regex_missing]]))

        test_case = (test_name, distribution, num_values, num_clients,
                     num_reports_per_client) + params
        row_str = [str(element) for element in test_case]
        rows.append(row_str)

  for params in DEMO:
    rows.append(params)

  for row in rows:
    print ' '.join(row)

if __name__ == '__main__':
  try:
    main(sys.argv)
  except RuntimeError, e:
    print >>sys.stderr, 'FATAL: %s' % e
    sys.exit(1)
